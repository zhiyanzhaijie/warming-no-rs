import { isTauriRuntime } from '../desktop/tauri'

export type TranskunStatus = {
  available: boolean
  command: string | null
  pythonAvailable: boolean
  pythonCommand: string | null
  detail: string
  platform: string
}

export type SelectedAudioFile = {
  path: string
  name: string
  sizeBytes: number
}

export type TranscriptionTask = {
  status: 'idle' | 'running' | 'cancelling' | 'succeeded' | 'failed'
  inputPath: string | null
  inputName: string | null
  inputSizeBytes: number | null
  outputPath: string | null
  startedAtMs: number | null
  finishedAtMs: number | null
  logs: string[]
  error: string | null
}

export type TranskunInstallTask = {
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  logs: string[]
  error: string | null
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
  getInstallTask: () => invokeDesktop<TranskunInstallTask>('get_transkun_install_task'),
  installTranskun: () => invokeDesktop<TranskunStatus>('install_transkun'),
  selectAudio: () => invokeDesktop<SelectedAudioFile | null>('select_audio_file'),
  getTask: () => invokeDesktop<TranscriptionTask>('get_transcription_task'),
  generateMidi: (inputPath: string) =>
    invokeDesktop<TranscriptionTask | null>('generate_midi', { inputPath }),
  cancelTask: () => invokeDesktop<TranscriptionTask>('cancel_transcription_task'),
  resetTask: () => invokeDesktop<TranscriptionTask>('reset_transcription_task'),
}
