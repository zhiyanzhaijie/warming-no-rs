use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiInputDevice {
    id: String,
    name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum MidiInputEvent {
    NoteOn {
        source_id: String,
        channel: u8,
        pitch: u8,
        velocity: u8,
    },
    NoteOff {
        source_id: String,
        channel: u8,
        pitch: u8,
        velocity: u8,
    },
    ControlChange {
        source_id: String,
        channel: u8,
        controller: u8,
        value: u8,
    },
}

pub struct MidiInputState {
    connection: Mutex<Option<midir::MidiInputConnection<()>>>,
}

impl Default for MidiInputState {
    fn default() -> Self {
        Self {
            connection: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn midi_list_inputs() -> Result<Vec<MidiInputDevice>, String> {
    let input =
        midir::MidiInput::new("agent-piano-input-list").map_err(|error| error.to_string())?;
    input
        .ports()
        .iter()
        .enumerate()
        .map(|(index, port)| {
            let name = input.port_name(port).map_err(|error| error.to_string())?;
            Ok(MidiInputDevice {
                id: format!("midi:{index}:{name}"),
                name,
            })
        })
        .collect()
}

#[tauri::command]
pub fn midi_connect_input(
    app: AppHandle,
    state: State<'_, MidiInputState>,
    device_id: String,
) -> Result<(), String> {
    let mut input =
        midir::MidiInput::new("agent-piano-input").map_err(|error| error.to_string())?;
    input.ignore(midir::Ignore::None);
    let port = input
        .ports()
        .into_iter()
        .enumerate()
        .find_map(|(index, port)| {
            let name = input.port_name(&port).ok()?;
            (format!("midi:{index}:{name}") == device_id).then_some(port)
        })
        .ok_or_else(|| "MIDI 输入设备已断开。".to_string())?;
    let source_id = device_id.clone();
    let connection = input
        .connect(
            &port,
            "agent-piano-input-connection",
            move |_, message, _| {
                if let Some(event) = parse_message(&source_id, message) {
                    let _ = app.emit("piano-input", event);
                }
            },
            (),
        )
        .map_err(|error| error.to_string())?;
    *state
        .connection
        .lock()
        .map_err(|_| "MIDI 状态锁异常".to_string())? = Some(connection);
    Ok(())
}

#[tauri::command]
pub fn midi_disconnect_input(state: State<'_, MidiInputState>) -> Result<(), String> {
    *state
        .connection
        .lock()
        .map_err(|_| "MIDI 状态锁异常".to_string())? = None;
    Ok(())
}

fn parse_message(source_id: &str, message: &[u8]) -> Option<MidiInputEvent> {
    let status = *message.first()?;
    let kind = status & 0xf0;
    let channel = status & 0x0f;
    match (kind, message.get(1).copied(), message.get(2).copied()) {
        (0x90, Some(pitch), Some(velocity)) if velocity > 0 => Some(MidiInputEvent::NoteOn {
            source_id: source_id.to_string(),
            channel,
            pitch,
            velocity,
        }),
        (0x80 | 0x90, Some(pitch), Some(velocity)) => Some(MidiInputEvent::NoteOff {
            source_id: source_id.to_string(),
            channel,
            pitch,
            velocity,
        }),
        (0xb0, Some(controller), Some(value)) => Some(MidiInputEvent::ControlChange {
            source_id: source_id.to_string(),
            channel,
            controller,
            value,
        }),
        _ => None,
    }
}
