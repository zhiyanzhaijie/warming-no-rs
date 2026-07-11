mod python_sidecar;
mod transcription;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
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
      python_sidecar::music_list_watch_paths,
      python_sidecar::music_add_watch_path,
      python_sidecar::music_add_watch_paths,
      python_sidecar::music_refresh_library,
      python_sidecar::select_midi_watch_directories,
      transcription::check_transkun,
      transcription::select_audio_file,
      transcription::generate_midi
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
