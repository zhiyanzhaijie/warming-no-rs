import { isTauriRuntime } from './tauri'

export async function importMidiFile() {
  if (!isTauriRuntime()) {
    return { ok: false, reason: 'Tauri runtime is not available in web dev mode.' }
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('import_midi_file')
}
