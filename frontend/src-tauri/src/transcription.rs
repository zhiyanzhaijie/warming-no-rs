use serde::Serialize;
use std::{
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

const SUPPORTED_AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "aif", "wma",
];
const MAX_LOG_LINES: usize = 160;

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .is_some_and(|extension| SUPPORTED_AUDIO_EXTENSIONS.contains(&extension.as_str()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranskunStatus {
    available: bool,
    command: Option<String>,
    python_available: bool,
    python_command: Option<String>,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedAudioFile {
    path: String,
    name: String,
    size_bytes: u64,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionTask {
    status: TranscriptionTaskStatus,
    input_path: Option<String>,
    input_name: Option<String>,
    input_size_bytes: Option<u64>,
    output_path: Option<String>,
    started_at_ms: Option<u64>,
    finished_at_ms: Option<u64>,
    logs: Vec<String>,
    error: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
enum TranscriptionTaskStatus {
    #[default]
    Idle,
    Running,
    Cancelling,
    Succeeded,
    Failed,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranskunInstallTask {
    status: TranskunInstallStatus,
    logs: Vec<String>,
    error: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
enum TranskunInstallStatus {
    #[default]
    Idle,
    Running,
    Succeeded,
    Failed,
}

#[derive(Clone, Default)]
pub struct TranscriptionState {
    task: Arc<Mutex<TranscriptionTask>>,
    install_task: Arc<Mutex<TranskunInstallTask>>,
    cancel_requested: Arc<AtomicBool>,
}

#[derive(Clone)]
struct TranskunCommand {
    executable: PathBuf,
}

impl TranskunCommand {
    fn label(&self) -> String {
        "transkun".to_string()
    }

    fn spawn(&self, input: &Path, output: &Path) -> Result<Child, String> {
        Command::new(&self.executable)
            .arg(input)
            .arg(output)
            .env("PYTHONUNBUFFERED", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("无法启动 TransKun：{error}"))
    }
}

fn find_transkun() -> Option<TranskunCommand> {
    let python = find_python()?;
    if !transkun_runtime_available(&python) {
        return None;
    }

    let path_command = PathBuf::from("transkun");
    if transkun_command_available(&path_command) {
        return Some(TranskunCommand {
            executable: path_command,
        });
    }

    let python_path = Path::new(&python);
    if let Some(executable) = python_path
        .parent()
        .map(|directory| directory.join("transkun"))
        .filter(|executable| transkun_command_available(executable))
    {
        return Some(TranskunCommand { executable });
    }

    let output = Command::new(&python)
        .args(["-m", "site", "--user-base"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let user_base = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if user_base.is_empty() {
        return None;
    }

    let executable = PathBuf::from(user_base).join("bin").join("transkun");
    transkun_command_available(&executable).then_some(TranskunCommand { executable })
}

fn transkun_command_available(executable: &Path) -> bool {
    matches!(
        Command::new(executable).arg("--help").output(),
        Ok(output) if output.status.success()
    )
}

fn transkun_runtime_available(python: &str) -> bool {
    matches!(
        Command::new(python)
            .args(["-c", "import pkg_resources; import pydub"])
            .output(),
        Ok(output) if output.status.success()
    )
}

fn find_python() -> Option<String> {
    let mut candidates = vec![
        PathBuf::from("/Library/Frameworks/Python.framework/Versions/Current/bin/python3"),
        PathBuf::from("/opt/homebrew/bin/python3"),
        PathBuf::from("/usr/local/bin/python3"),
        PathBuf::from("python3"),
        PathBuf::from("python"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        candidates.push(PathBuf::from(home).join(".local/bin/python3"));
    }

    candidates.into_iter().find_map(|python| {
        let output = Command::new(&python)
            .args(["-c", "import sys; print(sys.executable)"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let executable = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if executable.starts_with("/usr/bin/") || executable.contains("/Xcode.app/") {
            return None;
        }
        Some(executable)
    })
}

#[tauri::command]
pub async fn check_transkun() -> TranskunStatus {
    match tauri::async_runtime::spawn_blocking(find_transkun).await {
        Ok(Some(command)) => TranskunStatus {
            available: true,
            command: Some(command.label()),
            python_available: true,
            python_command: find_python(),
            detail: "TransKun 已就绪，可以开始转换。".to_string(),
        },
        Ok(None) => match find_python() {
            Some(python) => TranskunStatus {
                available: false,
                command: None,
                python_available: true,
                python_command: Some(python),
                detail: "已找到 Python，但还没有安装 TransKun。".to_string(),
            },
            None => TranskunStatus {
                available: false,
                command: None,
                python_available: false,
                python_command: None,
                detail: "没有找到 Python。请先安装 Python。".to_string(),
            },
        },
        Err(error) => TranskunStatus {
            available: false,
            command: None,
            python_available: false,
            python_command: None,
            detail: format!("检测 TransKun 时发生错误：{error}"),
        },
    }
}

#[tauri::command]
pub fn get_transkun_install_task(
    state: State<'_, TranscriptionState>,
) -> TranskunInstallTask {
    state
        .install_task
        .lock()
        .unwrap_or_else(|lock| lock.into_inner())
        .clone()
}

#[tauri::command]
pub async fn install_transkun(
    state: State<'_, TranscriptionState>,
) -> Result<TranskunStatus, String> {
    let install_task = state.install_task.clone();
    {
        let mut task = install_task.lock().unwrap_or_else(|lock| lock.into_inner());
        if task.status == TranskunInstallStatus::Running {
            return Err("TransKun 正在安装，请稍候。".to_string());
        }
        *task = TranskunInstallTask {
            status: TranskunInstallStatus::Running,
            logs: vec!["正在准备 TransKun 安装环境".to_string()],
            error: None,
        };
    }

    tauri::async_runtime::spawn_blocking(move || run_transkun_install(install_task))
        .await
        .map_err(|error| error.to_string())?
}

fn run_transkun_install(
    install_task: Arc<Mutex<TranskunInstallTask>>,
) -> Result<TranskunStatus, String> {
    let python = match find_python() {
        Some(python) => python,
        None => {
            let error = "没有找到 Python，请先安装 Python。".to_string();
            finish_install_task(&install_task, TranskunInstallStatus::Failed, Some(error.clone()));
            return Err(error);
        }
    };
    push_install_log(&install_task, format!("使用 Python：{python}"));
    push_install_log(&install_task, "正在下载并安装 TransKun 及其依赖".to_string());

    let mut child = match Command::new(&python)
            .args([
                "-m",
                "pip",
                "install",
                "transkun",
                "setuptools<82",
                "audioop-lts; python_version >= '3.13'",
            ])
            .env("PYTHONUNBUFFERED", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let error = format!("无法启动 Python：{error}");
            finish_install_task(&install_task, TranskunInstallStatus::Failed, Some(error.clone()));
            return Err(error);
        }
    };

    let mut readers = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        let task = install_task.clone();
        readers.push(thread::spawn(move || read_install_output(stdout, task)));
    }
    if let Some(stderr) = child.stderr.take() {
        let task = install_task.clone();
        readers.push(thread::spawn(move || read_install_output(stderr, task)));
    }
    let status = child.wait().map_err(|error| format!("等待安装进程时发生错误：{error}"));
    for reader in readers {
        let _ = reader.join();
    }

    match status {
        Ok(status) if status.success() => match find_transkun() {
            Some(command) => {
                push_install_log(&install_task, "TransKun 安装完成".to_string());
                finish_install_task(&install_task, TranskunInstallStatus::Succeeded, None);
                Ok(TranskunStatus {
                available: true,
                command: Some(command.label()),
                python_available: true,
                python_command: Some(python),
                detail: "TransKun 已安装，可以开始转换。".to_string(),
                })
            }
            None => {
                let error = "安装完成，但应用仍未找到 TransKun。请重新检测。".to_string();
                finish_install_task(&install_task, TranskunInstallStatus::Failed, Some(error.clone()));
                Err(error)
            }
        },
        Ok(status) => {
            let error = format!("TransKun 安装失败，退出状态：{status}");
            finish_install_task(&install_task, TranskunInstallStatus::Failed, Some(error.clone()));
            Err(error)
        }
        Err(error) => {
            finish_install_task(&install_task, TranskunInstallStatus::Failed, Some(error.clone()));
            Err(error)
        }
    }
}

fn read_install_output<R: Read>(reader: R, task: Arc<Mutex<TranskunInstallTask>>) {
    for line in BufReader::new(reader).lines() {
        match line {
            Ok(line) if !line.trim().is_empty() => push_install_log(&task, line),
            Ok(_) => {}
            Err(error) => {
                push_install_log(&task, format!("读取安装日志失败：{error}"));
                break;
            }
        }
    }
}

fn push_install_log(task: &Arc<Mutex<TranskunInstallTask>>, line: String) {
    let mut task = task.lock().unwrap_or_else(|lock| lock.into_inner());
    task.logs.push(line);
    if task.logs.len() > MAX_LOG_LINES {
        let overflow = task.logs.len() - MAX_LOG_LINES;
        task.logs.drain(0..overflow);
    }
}

fn finish_install_task(
    task: &Arc<Mutex<TranskunInstallTask>>,
    status: TranskunInstallStatus,
    error: Option<String>,
) {
    let mut task = task.lock().unwrap_or_else(|lock| lock.into_inner());
    task.status = status;
    task.error = error;
}

#[tauri::command]
pub fn select_audio_file() -> Result<Option<SelectedAudioFile>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("选择要转换的音频")
        .add_filter("音频文件", SUPPORTED_AUDIO_EXTENSIONS)
        .pick_file()
    else {
        return Ok(None);
    };

    if !is_supported_audio_file(&path) {
        return Err(format!(
            "不支持此音频格式。可选择：{}。",
            SUPPORTED_AUDIO_EXTENSIONS.join("、")
        ));
    }

    let metadata = path
        .metadata()
        .map_err(|error| format!("无法读取文件：{error}"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio")
        .to_string();
    Ok(Some(SelectedAudioFile {
        path: path.display().to_string(),
        name,
        size_bytes: metadata.len(),
    }))
}

#[tauri::command]
pub fn get_transcription_task(state: State<'_, TranscriptionState>) -> TranscriptionTask {
    state
        .task
        .lock()
        .unwrap_or_else(|lock| lock.into_inner())
        .clone()
}

#[tauri::command]
pub async fn generate_midi(
    state: State<'_, TranscriptionState>,
    input_path: String,
) -> Result<Option<TranscriptionTask>, String> {
    {
        let task = state.task.lock().unwrap_or_else(|lock| lock.into_inner());
        if matches!(
            task.status,
            TranscriptionTaskStatus::Running | TranscriptionTaskStatus::Cancelling
        ) {
            return Err("已有音频正在转换，请等待当前任务完成。".to_string());
        }
    }

    let input = PathBuf::from(&input_path);
    if !input.is_file() || !is_supported_audio_file(&input) {
        return Err("所选音频已不存在或格式无效，请重新选择。".to_string());
    }

    let default_name = input
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|name| format!("{name}.mid"))
        .unwrap_or_else(|| "transcription.mid".to_string());
    let Some(output) = rfd::FileDialog::new()
        .set_title("保存生成的 MIDI")
        .set_file_name(&default_name)
        .add_filter("MIDI 文件", &["mid", "midi"])
        .save_file()
    else {
        return Ok(None);
    };

    let command = find_transkun().ok_or_else(|| "TransKun 当前不可用，请重新检测。".to_string())?;
    let metadata = input
        .metadata()
        .map_err(|error| format!("无法读取文件：{error}"))?;
    let input_name = input
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio")
        .to_string();
    let task_handle = state.task.clone();
    let cancel_requested = state.cancel_requested.clone();
    cancel_requested.store(false, Ordering::Release);

    let snapshot = TranscriptionTask {
        status: TranscriptionTaskStatus::Running,
        input_path: Some(input.display().to_string()),
        input_name: Some(input_name),
        input_size_bytes: Some(metadata.len()),
        output_path: Some(output.display().to_string()),
        started_at_ms: Some(now_ms()),
        finished_at_ms: None,
        logs: vec![format!("启动 {}", command.label())],
        error: None,
    };
    *task_handle.lock().unwrap_or_else(|lock| lock.into_inner()) = snapshot.clone();

    tauri::async_runtime::spawn_blocking(move || {
        run_transcription(command, input, output, task_handle, cancel_requested)
    });
    Ok(Some(snapshot))
}

#[tauri::command]
pub fn cancel_transcription_task(
    state: State<'_, TranscriptionState>,
) -> Result<TranscriptionTask, String> {
    let snapshot = {
        let mut task = state.task.lock().unwrap_or_else(|lock| lock.into_inner());
        if task.status != TranscriptionTaskStatus::Running {
            return Err("当前没有正在运行的转换任务。".to_string());
        }
        task.status = TranscriptionTaskStatus::Cancelling;
        task.logs.push("正在取消 TransKun...".to_string());
        task.clone()
    };
    state.cancel_requested.store(true, Ordering::Release);
    Ok(snapshot)
}

#[tauri::command]
pub fn reset_transcription_task(
    state: State<'_, TranscriptionState>,
) -> Result<TranscriptionTask, String> {
    let mut task = state.task.lock().unwrap_or_else(|lock| lock.into_inner());
    if matches!(
        task.status,
        TranscriptionTaskStatus::Running | TranscriptionTaskStatus::Cancelling
    ) {
        return Err("转换仍在运行，请先取消当前任务。".to_string());
    }
    *task = TranscriptionTask::default();
    state.cancel_requested.store(false, Ordering::Release);
    Ok(task.clone())
}

fn run_transcription(
    command: TranskunCommand,
    input: PathBuf,
    output: PathBuf,
    task: Arc<Mutex<TranscriptionTask>>,
    cancel_requested: Arc<AtomicBool>,
) {
    let temporary_output = temporary_output_path(&output);
    let mut child = match command.spawn(&input, &temporary_output) {
        Ok(child) => child,
        Err(error) => {
            finish_task(&task, TranscriptionTaskStatus::Failed, Some(error));
            return;
        }
    };

    let mut readers = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        let task = task.clone();
        readers.push(std::thread::spawn(move || {
            read_process_output(stdout, task)
        }));
    }
    if let Some(stderr) = child.stderr.take() {
        let task = task.clone();
        readers.push(std::thread::spawn(move || {
            read_process_output(stderr, task)
        }));
    }

    let (result, cancelled) = loop {
        if cancel_requested.load(Ordering::Acquire) {
            let _ = child.kill();
            break (child.wait(), true);
        }
        match child.try_wait() {
            Ok(Some(status)) => break (Ok(status), false),
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => break (Err(error), false),
        }
    };
    for reader in readers {
        let _ = reader.join();
    }

    if cancelled || cancel_requested.load(Ordering::Acquire) {
        let _ = std::fs::remove_file(&temporary_output);
        *task.lock().unwrap_or_else(|lock| lock.into_inner()) = TranscriptionTask::default();
        cancel_requested.store(false, Ordering::Release);
        return;
    }

    match result {
        Ok(status) if status.success() && temporary_output.is_file() => {
            match install_output(&temporary_output, &output) {
                Ok(()) => {
                    push_log(&task, "MIDI 文件已生成".to_string());
                    finish_task(&task, TranscriptionTaskStatus::Succeeded, None);
                }
                Err(error) => finish_task(&task, TranscriptionTaskStatus::Failed, Some(error)),
            }
        }
        Ok(status) if status.success() => finish_task(
            &task,
            TranscriptionTaskStatus::Failed,
            Some("TransKun 已结束，但没有找到生成的 MIDI 文件。".to_string()),
        ),
        Ok(status) => finish_task(
            &task,
            TranscriptionTaskStatus::Failed,
            Some(format!("TransKun 转换失败，退出状态：{status}")),
        ),
        Err(error) => finish_task(
            &task,
            TranscriptionTaskStatus::Failed,
            Some(format!("等待 TransKun 结束时发生错误：{error}")),
        ),
    }
    let _ = std::fs::remove_file(temporary_output);
}

fn temporary_output_path(output: &Path) -> PathBuf {
    let file_name = output
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("transcription");
    output.with_file_name(format!(".{file_name}.{}.partial.mid", now_ms()))
}

fn install_output(temporary_output: &Path, output: &Path) -> Result<(), String> {
    std::fs::rename(temporary_output, output)
        .map_err(|error| format!("无法保存生成的 MIDI 文件：{error}"))
}

fn read_process_output(mut stream: impl Read, task: Arc<Mutex<TranscriptionTask>>) {
    let mut buffer = [0_u8; 1024];
    let mut pending = Vec::new();
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(length) => {
                for byte in &buffer[..length] {
                    if *byte == b'\n' || *byte == b'\r' {
                        flush_log_buffer(&task, &mut pending);
                    } else {
                        pending.push(*byte);
                    }
                }
            }
            Err(error) => {
                push_log(&task, format!("读取 TransKun 输出失败：{error}"));
                break;
            }
        }
    }
    flush_log_buffer(&task, &mut pending);
}

fn flush_log_buffer(task: &Arc<Mutex<TranscriptionTask>>, pending: &mut Vec<u8>) {
    if pending.is_empty() {
        return;
    }
    let line = String::from_utf8_lossy(pending).trim().to_string();
    pending.clear();
    if !line.is_empty() {
        push_log(task, line);
    }
}

fn push_log(task: &Arc<Mutex<TranscriptionTask>>, line: String) {
    let mut task = task.lock().unwrap_or_else(|lock| lock.into_inner());
    if task.logs.last() == Some(&line) {
        return;
    }
    task.logs.push(line);
    if task.logs.len() > MAX_LOG_LINES {
        let overflow = task.logs.len() - MAX_LOG_LINES;
        task.logs.drain(..overflow);
    }
}

fn finish_task(
    task: &Arc<Mutex<TranscriptionTask>>,
    status: TranscriptionTaskStatus,
    error: Option<String>,
) {
    let mut task = task.lock().unwrap_or_else(|lock| lock.into_inner());
    if let Some(error) = &error {
        task.logs.push(error.clone());
    }
    task.status = status;
    task.error = error;
    task.finished_at_ms = Some(now_ms());
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
