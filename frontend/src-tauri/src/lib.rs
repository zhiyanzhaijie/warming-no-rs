mod audio_output;
mod midi_input;
mod python_sidecar;
mod transcription;

use tauri::{path::BaseDirectory, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let soundfont = app
                .path()
                .resolve("resources/default.sf2", BaseDirectory::Resource)
                .unwrap_or_else(|_| {
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("resources/default.sf2")
                });
            app.manage(audio_output::AudioOutput::start(soundfont));
            app.manage(midi_input::MidiInputState::default());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            python_sidecar::music_list_pieces,
            python_sidecar::music_get_piece,
            python_sidecar::music_get_piece_score,
            python_sidecar::music_delete_piece,
            python_sidecar::music_list_watch_paths,
            python_sidecar::music_add_watch_path,
            python_sidecar::music_add_watch_paths,
            python_sidecar::music_refresh_library,
            python_sidecar::select_midi_watch_directories,
            transcription::check_transkun,
            transcription::select_audio_file,
            transcription::generate_midi,
            audio_output::audio_output_status,
            audio_output::audio_send_events,
            audio_output::audio_stop_all,
            midi_input::midi_list_inputs,
            midi_input::midi_connect_input,
            midi_input::midi_disconnect_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
