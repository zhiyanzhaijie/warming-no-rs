use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::{Command, Output},
};

const SUPPORTED_AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "aif", "wma",
];

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
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedAudioFile {
    path: String,
    name: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiGenerationResult {
    output_path: String,
}

#[derive(Clone)]
enum TranskunCommand {
    Executable,
    PythonModule(String),
}

impl TranskunCommand {
    fn label(&self) -> String {
        match self {
            Self::Executable => "transkun".to_string(),
            Self::PythonModule(python) => format!("{python} -m transkun"),
        }
    }

    fn run(&self, input: &Path, output: &Path) -> Result<Output, String> {
        match self {
            Self::Executable => Command::new("transkun").arg(input).arg(output).output(),
            Self::PythonModule(python) => Command::new(python)
                .args(["-m", "transkun"])
                .arg(input)
                .arg(output)
                .output(),
        }
        .map_err(|error| format!("无法启动 TransKun：{error}"))
    }
}

fn find_transkun() -> Option<TranskunCommand> {
    if Command::new("transkun").arg("--help").output().is_ok() {
        return Some(TranskunCommand::Executable);
    }

    ["python3", "python"].into_iter().find_map(|python| {
        Command::new(python)
            .args(["-m", "transkun", "--help"])
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|_| TranskunCommand::PythonModule(python.to_string()))
    })
}

#[tauri::command]
pub fn check_transkun() -> TranskunStatus {
    match find_transkun() {
        Some(command) => TranskunStatus {
            available: true,
            command: Some(command.label()),
            detail: "TransKun 已就绪，可以开始转换。".to_string(),
        },
        None => TranskunStatus {
            available: false,
            command: None,
            detail: "未找到 TransKun。请先在本机 Python 环境中安装并确保命令可用。".to_string(),
        },
    }
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

    let metadata = path.metadata().map_err(|error| format!("无法读取文件：{error}"))?;
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
pub async fn generate_midi(input_path: String) -> Result<Option<MidiGenerationResult>, String> {
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

    tauri::async_runtime::spawn_blocking(move || {
        let command =
            find_transkun().ok_or_else(|| "TransKun 当前不可用，请重新检测。".to_string())?;
        let result = command.run(&input, &output)?;
        if !result.status.success() {
            let detail = String::from_utf8_lossy(&result.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "TransKun 转换失败，未生成 MIDI 文件。".to_string()
            } else {
                format!("TransKun 转换失败：{detail}")
            });
        }
        if !output.is_file() {
            return Err("TransKun 已结束，但没有找到生成的 MIDI 文件。".to_string());
        }

        Ok(Some(MidiGenerationResult {
            output_path: output.display().to_string(),
        }))
    })
    .await
    .map_err(|error| format!("TransKun 后台任务异常结束：{error}"))?
}
