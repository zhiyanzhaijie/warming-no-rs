import { isTauriRuntime } from '../../../desktop/tauri'
import type { PianoInputEvent } from './types'

type RawMidiDevice = { id: string; name: string }
type RawMidiEvent = Omit<PianoInputEvent, 'timestamp'>

export async function listMidiInputs() {
  if (!isTauriRuntime()) return []
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<RawMidiDevice[]>('midi_list_inputs')
}

export async function connectMidiInput(deviceId: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('midi_connect_input', { deviceId })
}

export async function disconnectMidiInput() {
  if (!isTauriRuntime()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('midi_disconnect_input')
}

export async function listenToMidiInput(listener: (event: PianoInputEvent) => void) {
  if (!isTauriRuntime()) return () => undefined
  const { listen } = await import('@tauri-apps/api/event')
  return listen<RawMidiEvent>('piano-input', ({ payload }) => {
    listener({ ...payload, timestamp: performance.now() } as PianoInputEvent)
  })
}
