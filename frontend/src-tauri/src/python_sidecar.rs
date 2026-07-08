use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock,
    },
};

static SIDECAR: OnceLock<Mutex<PythonSidecar>> = OnceLock::new();
static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
struct RpcRequest<'a> {
    id: String,
    method: &'a str,
    params: Value,
}

#[derive(Debug, Deserialize)]
struct RpcResponse {
    id: String,
    ok: bool,
    result: Option<Value>,
    error: Option<String>,
}

pub fn call(method: &str, params: Value) -> Result<Value, String> {
    let sidecar = SIDECAR.get_or_init(|| Mutex::new(PythonSidecar::new()));
    let mut sidecar = sidecar
        .lock()
        .map_err(|_| "python sidecar lock poisoned".to_string())?;
    sidecar.call(method, params)
}

struct PythonSidecar {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<std::process::ChildStdout>>,
}

impl PythonSidecar {
    fn new() -> Self {
        Self {
            child: None,
            stdin: None,
            stdout: None,
        }
    }

    fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.ensure_running()?;
        let request_id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed).to_string();
        let request = RpcRequest {
            id: request_id.clone(),
            method,
            params,
        };
        let line = serde_json::to_string(&request).map_err(|error| error.to_string())?;

        let stdin = self
            .stdin
            .as_mut()
            .ok_or_else(|| "python sidecar stdin is not available".to_string())?;
        stdin
            .write_all(line.as_bytes())
            .and_then(|_| stdin.write_all(b"\n"))
            .and_then(|_| stdin.flush())
            .map_err(|error| error.to_string())?;

        let stdout = self
            .stdout
            .as_mut()
            .ok_or_else(|| "python sidecar stdout is not available".to_string())?;
        let mut response_line = String::new();
        stdout
            .read_line(&mut response_line)
            .map_err(|error| error.to_string())?;
        if response_line.trim().is_empty() {
            return Err("python sidecar returned an empty response".to_string());
        }

        let response: RpcResponse =
            serde_json::from_str(&response_line).map_err(|error| error.to_string())?;
        if response.id != request_id {
            return Err("python sidecar response id mismatch".to_string());
        }
        if response.ok {
            Ok(response.result.unwrap_or(Value::Null))
        } else {
            Err(response
                .error
                .unwrap_or_else(|| "python sidecar request failed".to_string()))
        }
    }

    fn ensure_running(&mut self) -> Result<(), String> {
        if let Some(child) = self.child.as_mut() {
            if child.try_wait().map_err(|error| error.to_string())?.is_none() {
                return Ok(());
            }
        }

        let backend_dir = find_backend_dir()?;
        let python = backend_dir.join(".venv/bin/python");
        if !python.exists() {
            return Err(format!(
                "backend virtualenv is missing: {}. Run `cd backend && ~/.local/bin/uv sync --extra dev`.",
                python.display()
            ));
        }

        let mut child = Command::new(python)
            .arg("-m")
            .arg("core.rpc")
            .current_dir(&backend_dir)
            .env("PYTHONUNBUFFERED", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| error.to_string())?;

        self.stdin = child.stdin.take();
        self.stdout = child.stdout.take().map(BufReader::new);
        self.child = Some(child);
        Ok(())
    }
}

fn find_backend_dir() -> Result<PathBuf, String> {
    let current = std::env::current_dir().map_err(|error| error.to_string())?;
    for ancestor in current.ancestors() {
        let direct = ancestor.join("backend/pyproject.toml");
        if direct.exists() {
            return Ok(ancestor.join("backend"));
        }
        let sibling = ancestor.join("../backend/pyproject.toml");
        if sibling.exists() {
            return ancestor
                .join("../backend")
                .canonicalize()
                .map_err(|error| error.to_string());
        }
    }
    Err("could not locate backend directory".to_string())
}

#[tauri::command]
pub fn music_list_pieces() -> Result<Value, String> {
    call("music_list_pieces", json!({}))
}

#[tauri::command]
pub fn music_get_piece(piece_id: String) -> Result<Value, String> {
    call("music_get_piece", json!({ "piece_id": piece_id }))
}

#[tauri::command]
pub fn music_list_watch_paths() -> Result<Value, String> {
    call("music_list_watch_paths", json!({}))
}

#[tauri::command]
pub fn music_add_watch_path(path: String) -> Result<Value, String> {
    call("music_add_watch_path", json!({ "path": path }))
}

#[tauri::command]
pub fn music_refresh_library() -> Result<Value, String> {
    call("music_refresh_library", json!({}))
}
