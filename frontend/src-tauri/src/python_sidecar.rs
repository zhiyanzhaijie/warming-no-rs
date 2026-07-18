use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock,
    },
};
use tauri::Manager;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

static SIDECAR: OnceLock<Mutex<PythonSidecar>> = OnceLock::new();
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static LAUNCH_CONFIG: OnceLock<LaunchConfig> = OnceLock::new();
static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

enum LaunchConfig {
    Development {
        backend_dir: PathBuf,
        python: PathBuf,
    },
    Packaged {
        state_path: PathBuf,
    },
}

pub fn init(app: &tauri::AppHandle) -> Result<(), String> {
    let launch_config = if cfg!(debug_assertions) {
        let backend_dir = find_backend_dir()?;
        let python = backend_dir.join(".venv/bin/python");
        if !python.exists() {
            return Err(format!(
                "backend virtualenv is missing: {}. Run `cd backend && uv sync --extra dev`.",
                python.display()
            ));
        }
        LaunchConfig::Development {
            backend_dir,
            python,
        }
    } else {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
        LaunchConfig::Packaged {
            state_path: data_dir.join("app.db"),
        }
    };

    LAUNCH_CONFIG
        .set(launch_config)
        .map_err(|_| "python sidecar launch config is already initialized".to_string())?;
    APP_HANDLE
        .set(app.clone())
        .map_err(|_| "python sidecar app handle is already initialized".to_string())
}

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

pub async fn call_async(method: &'static str, params: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || call(method, params))
        .await
        .map_err(|error| error.to_string())?
}

struct PythonSidecar {
    child: Option<CommandChild>,
    events: Option<tauri::async_runtime::Receiver<CommandEvent>>,
}

impl PythonSidecar {
    fn new() -> Self {
        Self {
            child: None,
            events: None,
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

        let child = self
            .child
            .as_mut()
            .ok_or_else(|| "python sidecar stdin is not available".to_string())?;
        if let Err(error) = child.write(format!("{line}\n").as_bytes()) {
            self.stop();
            return Err(error.to_string());
        }

        let events = self
            .events
            .as_mut()
            .ok_or_else(|| "python sidecar stdout is not available".to_string())?;
        let response_line = loop {
            let event = tauri::async_runtime::block_on(events.recv());
            match event {
                Some(CommandEvent::Stdout(line)) => {
                    break String::from_utf8(line).map_err(|error| error.to_string())?;
                }
                Some(CommandEvent::Stderr(line)) => {
                    log::error!("python sidecar: {}", String::from_utf8_lossy(&line));
                }
                Some(CommandEvent::Error(error)) => return Err(error),
                Some(CommandEvent::Terminated(status)) => {
                    self.child = None;
                    self.events = None;
                    return Err(format!(
                        "python sidecar terminated with code {:?}",
                        status.code
                    ));
                }
                None => {
                    self.child = None;
                    self.events = None;
                    return Err("python sidecar event stream closed".to_string());
                }
                _ => continue,
            }
        };

        let response: RpcResponse =
            serde_json::from_str(&response_line).map_err(|error| error.to_string())?;
        if response.id != request_id {
            return Err("python sidecar response id mismatch".to_string());
        }
        if response.ok {
            Ok(match response.result {
                Some(result) => result,
                None => Value::Null,
            })
        } else {
            Err(match response.error {
                Some(error) => error,
                None => "python sidecar request failed".to_string(),
            })
        }
    }

    fn ensure_running(&mut self) -> Result<(), String> {
        if self.child.is_some() {
            return Ok(());
        }

        let app = APP_HANDLE
            .get()
            .ok_or_else(|| "python sidecar app handle is not initialized".to_string())?;
        let launch_config = LAUNCH_CONFIG
            .get()
            .ok_or_else(|| "python sidecar launch config is not initialized".to_string())?;
        let command = match launch_config {
            LaunchConfig::Development {
                backend_dir,
                python,
            } => app
                .shell()
                .command(python)
                .args(["-m", "core.rpc"])
                .current_dir(backend_dir),
            LaunchConfig::Packaged { state_path } => app
                .shell()
                .sidecar("warming-backend")
                .map_err(|error| error.to_string())?
                .env("WARMING_STATE_PATH", state_path),
        }
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1");
        let (events, child) = command.spawn().map_err(|error| error.to_string())?;

        self.child = Some(child);
        self.events = Some(events);
        Ok(())
    }

    fn stop(&mut self) {
        self.events = None;
        if let Some(child) = self.child.take() {
            if let Err(error) = child.kill() {
                log::warn!("failed to stop python sidecar: {error}");
            }
        }
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
pub async fn music_list_pieces() -> Result<Value, String> {
    call_async("music_list_pieces", json!({})).await
}

#[tauri::command]
pub async fn music_get_piece(piece_id: String) -> Result<Value, String> {
    call_async("music_get_piece", json!({ "piece_id": piece_id })).await
}

#[tauri::command]
pub async fn music_get_piece_score(piece_id: String) -> Result<Value, String> {
    call_async("music_get_piece_score", json!({ "piece_id": piece_id })).await
}

#[tauri::command]
pub async fn music_generate_fingering(
    piece_id: String,
    plan_id: String,
    stage_id: String,
) -> Result<Value, String> {
    call_async(
        "music_generate_fingering",
        json!({
            "piece_id": piece_id,
            "plan_id": plan_id,
            "stage_id": stage_id,
        }),
    )
    .await
}

#[tauri::command]
pub async fn music_delete_piece(piece_id: String) -> Result<Value, String> {
    call_async("music_delete_piece", json!({ "piece_id": piece_id })).await
}

#[tauri::command]
pub async fn app_get_storage_info() -> Result<Value, String> {
    call_async("app_get_storage_info", json!({})).await
}

#[tauri::command]
pub async fn music_list_watch_paths() -> Result<Value, String> {
    call_async("music_list_watch_paths", json!({})).await
}

#[tauri::command]
pub async fn music_add_watch_path(path: String) -> Result<Value, String> {
    call_async("music_add_watch_path", json!({ "path": path })).await
}

#[tauri::command]
pub async fn music_add_watch_paths(paths: Vec<String>) -> Result<Value, String> {
    call_async("music_add_watch_paths", json!({ "paths": paths })).await
}

#[tauri::command]
pub async fn music_remove_watch_path(path: String) -> Result<Value, String> {
    call_async("music_remove_watch_path", json!({ "path": path })).await
}

#[tauri::command]
pub async fn music_refresh_library() -> Result<Value, String> {
    call_async("music_refresh_library", json!({})).await
}

#[tauri::command]
pub fn select_midi_watch_directories() -> Result<Vec<String>, String> {
    let folders = rfd::FileDialog::new()
        .set_title("选择 MIDI 曲库文件夹")
        .pick_folders();
    let folders = match folders {
        Some(folders) => folders,
        None => Vec::new(),
    };
    Ok(folders
        .into_iter()
        .map(|path| path.display().to_string())
        .collect())
}
