use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    path::{Path, PathBuf},
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::Duration,
};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MidiEvent {
    NoteOn {
        channel: u8,
        note: u8,
        velocity: u8,
    },
    NoteOff {
        channel: u8,
        note: u8,
        velocity: u8,
    },
    ControlChange {
        channel: u8,
        controller: u8,
        value: u8,
    },
    ProgramChange {
        channel: u8,
        program: u8,
    },
    PitchBend {
        channel: u8,
        value: u16,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputStatus {
    available: bool,
    backend: &'static str,
    detail: String,
}

pub struct AudioOutput {
    sender: Option<Sender<MidiEvent>>,
    detail: String,
}

impl AudioOutput {
    pub fn start(soundfont_path: PathBuf) -> Self {
        let (event_tx, event_rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        thread::Builder::new()
            .name("soundfont-audio".to_string())
            .spawn(move || run_audio_thread(&soundfont_path, event_rx, ready_tx))
            .ok();

        match ready_rx.recv_timeout(Duration::from_secs(15)) {
            Ok(Ok(())) => Self {
                sender: Some(event_tx),
                detail: "默认钢琴 SoundFont 已加载。".to_string(),
            },
            Ok(Err(error)) => Self {
                sender: None,
                detail: error,
            },
            Err(_) => Self {
                sender: None,
                detail: "音频引擎初始化超时。".to_string(),
            },
        }
    }

    fn send(&self, events: Vec<MidiEvent>) -> Result<(), String> {
        let sender = self.sender.as_ref().ok_or_else(|| self.detail.clone())?;
        for event in events {
            validate_event(&event)?;
            sender
                .send(event)
                .map_err(|_| "音频线程已停止。".to_string())?;
        }
        Ok(())
    }

    fn stop_all(&self) -> Result<(), String> {
        let mut events = Vec::with_capacity(32);
        for channel in 0..16 {
            events.push(MidiEvent::ControlChange {
                channel,
                controller: 123,
                value: 0,
            });
            events.push(MidiEvent::ControlChange {
                channel,
                controller: 120,
                value: 0,
            });
        }
        self.send(events)
    }

    fn status(&self) -> AudioOutputStatus {
        AudioOutputStatus {
            available: self.sender.is_some(),
            backend: "OxiSynth",
            detail: self.detail.clone(),
        }
    }
}

fn validate_event(event: &MidiEvent) -> Result<(), String> {
    let channel = match event {
        MidiEvent::NoteOn { channel, .. }
        | MidiEvent::NoteOff { channel, .. }
        | MidiEvent::ControlChange { channel, .. }
        | MidiEvent::ProgramChange { channel, .. }
        | MidiEvent::PitchBend { channel, .. } => *channel,
    };
    if channel > 15 {
        return Err("MIDI channel 必须在 0 到 15 之间。".to_string());
    }
    if let MidiEvent::PitchBend { value, .. } = event {
        if *value > 16_383 {
            return Err("Pitch Bend 必须在 0 到 16383 之间。".to_string());
        }
    }
    Ok(())
}

fn run_audio_thread(
    soundfont_path: &Path,
    event_rx: Receiver<MidiEvent>,
    ready_tx: mpsc::SyncSender<Result<(), String>>,
) {
    match create_stream(soundfont_path, event_rx) {
        Ok(stream) => {
            if let Err(error) = stream.play() {
                let _ = ready_tx.send(Err(format!("无法启动音频输出：{error}")));
                return;
            }
            let _ = ready_tx.send(Ok(()));
            loop {
                thread::park();
            }
        }
        Err(error) => {
            let _ = ready_tx.send(Err(error));
        }
    }
}

fn create_stream(
    soundfont_path: &Path,
    event_rx: Receiver<MidiEvent>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "没有找到系统音频输出设备。".to_string())?;
    let supported = device
        .default_output_config()
        .map_err(|error| format!("无法读取音频设备配置：{error}"))?;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    match sample_format {
        cpal::SampleFormat::I8 => build_stream::<i8>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::I16 => build_stream::<i16>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::I32 => build_stream::<i32>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::I64 => build_stream::<i64>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::U8 => build_stream::<u8>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::U16 => build_stream::<u16>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::U32 => build_stream::<u32>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::U64 => build_stream::<u64>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::F32 => build_stream::<f32>(&device, &config, soundfont_path, event_rx),
        cpal::SampleFormat::F64 => build_stream::<f64>(&device, &config, soundfont_path, event_rx),
        format => Err(format!("暂不支持音频采样格式：{format}")),
    }
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    soundfont_path: &Path,
    event_rx: Receiver<MidiEvent>,
) -> Result<cpal::Stream, String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let mut synth = oxisynth::Synth::new(oxisynth::SynthDescriptor {
        sample_rate: config.sample_rate as f32,
        gain: 0.2,
        ..Default::default()
    })
    .map_err(|error| format!("无法创建 SoundFont 合成器：{error}"))?;
    let mut file =
        File::open(soundfont_path).map_err(|error| format!("无法打开默认 SoundFont：{error}"))?;
    let font = oxisynth::SoundFont::load(&mut file)
        .map_err(|error| format!("无法解析默认 SoundFont：{error}"))?;
    synth.add_font(font, true);

    let channels = config.channels as usize;
    device
        .build_output_stream(
            config,
            move |output: &mut [T], _: &cpal::OutputCallbackInfo| {
                for event in event_rx.try_iter() {
                    let _ = synth.send_event(to_synth_event(event));
                }
                for frame in output.chunks_mut(channels) {
                    let (left, right) = synth.read_next();
                    for (index, sample) in frame.iter_mut().enumerate() {
                        *sample = T::from_sample(if index % 2 == 0 { left } else { right });
                    }
                }
            },
            |error| log::error!("audio output error: {error}"),
            None,
        )
        .map_err(|error| format!("无法创建音频输出流：{error}"))
}

fn to_synth_event(event: MidiEvent) -> oxisynth::MidiEvent {
    match event {
        MidiEvent::NoteOn {
            channel,
            note,
            velocity,
        } => oxisynth::MidiEvent::NoteOn {
            channel,
            key: note,
            vel: velocity,
        },
        MidiEvent::NoteOff {
            channel,
            note,
            velocity,
        } => {
            let _release_velocity = velocity;
            oxisynth::MidiEvent::NoteOff { channel, key: note }
        }
        MidiEvent::ControlChange {
            channel,
            controller,
            value,
        } => oxisynth::MidiEvent::ControlChange {
            channel,
            ctrl: controller,
            value,
        },
        MidiEvent::ProgramChange { channel, program } => oxisynth::MidiEvent::ProgramChange {
            channel,
            program_id: program,
        },
        MidiEvent::PitchBend { channel, value } => {
            oxisynth::MidiEvent::PitchBend { channel, value }
        }
    }
}

#[tauri::command]
pub fn audio_output_status(output: tauri::State<'_, AudioOutput>) -> AudioOutputStatus {
    output.status()
}

#[tauri::command]
pub fn audio_send_events(
    output: tauri::State<'_, AudioOutput>,
    events: Vec<MidiEvent>,
) -> Result<(), String> {
    output.send(events)
}

#[tauri::command]
pub fn audio_stop_all(output: tauri::State<'_, AudioOutput>) -> Result<(), String> {
    output.stop_all()
}
