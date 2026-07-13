import { isTauriRuntime } from '../desktop/tauri'

type MidiChannelEvent = { channel: number }

export type MidiEvent =
  | (MidiChannelEvent & { type: 'noteOn'; note: number; velocity: number })
  | (MidiChannelEvent & { type: 'noteOff'; note: number; velocity: number })
  | (MidiChannelEvent & { type: 'controlChange'; controller: number; value: number })
  | (MidiChannelEvent & { type: 'programChange'; program: number })
  | (MidiChannelEvent & { type: 'pitchBend'; value: number })

export type AudioOutputStatus = {
  available: boolean
  backend: string
  detail: string
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) return undefined
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const instrumentOutput = {
  status: () => invokeDesktop<AudioOutputStatus>('audio_output_status'),
  send: (events: MidiEvent[]) =>
    events.length === 0 ? Promise.resolve(undefined) : invokeDesktop<void>('audio_send_events', { events }),
  sendComputerInput: (events: MidiEvent[]) =>
    events.length === 0 ? Promise.resolve(undefined) : invokeDesktop<void>('audio_send_computer_input_events', { events }),
  sendMidiInput: (events: MidiEvent[]) =>
    events.length === 0 ? Promise.resolve(undefined) : invokeDesktop<void>('audio_send_input_events', { events }),
  stopAll: () => invokeDesktop<void>('audio_stop_all'),
}
