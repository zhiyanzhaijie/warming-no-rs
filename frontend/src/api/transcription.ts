import { isTauriRuntime } from '../desktop/tauri'

export type TranskunStatus = {
  available: boolean
  command: string | null
  detail: string
}

export type SelectedAudioFile = {
  path: string
  name: string
  sizeBytes: number
}

type MidiGenerationResult = {
  outputPath: string
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('此功能需要在桌面应用中使用。')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const transcriptionApi = {
  checkTranskun: () => invokeDesktop<TranskunStatus>('check_transkun'),
  selectAudio: () => invokeDesktop<SelectedAudioFile | null>('select_audio_file'),
  generateMidi: (inputPath: string) =>
    invokeDesktop<MidiGenerationResult | null>('generate_midi', { inputPath }),
}
