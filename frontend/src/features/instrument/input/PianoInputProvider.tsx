import { useEffect, type ReactNode } from 'react'
import { pianoInputBus } from './PianoInputBus'
import { connectMidiInput, listenToMidiInput, listMidiInputs } from './midiInputApi'
import { computerKeyboardDevice, useInstrumentStore } from './instrumentStore'

export function PianoInputProvider({ children }: { children: ReactNode }) {
  const setMidiDevices = useInstrumentStore((state) => state.setMidiDevices)

  useEffect(() => {
    let cancelled = false
    let unlisten: () => void = () => undefined
    void Promise.all([listMidiInputs(), listenToMidiInput((event) => pianoInputBus.emit(event))])
      .then(([devices, stopListening]) => {
        if (cancelled) {
          stopListening()
          return
        }
        unlisten = stopListening
        setMidiDevices(
          devices.map((device) => ({
            ...device,
            kind: 'midi-keyboard' as const,
            keyCount: null,
            lowestPitch: null,
            highestPitch: null,
            supportsVelocity: true,
            supportsSustain: true,
            calibrated: false,
          })),
        )
        const state = useInstrumentStore.getState()
        const activeDevice = state.devices.find(
          (device) => device.id === state.activeDeviceId,
        )
        if (activeDevice?.kind === 'midi-keyboard') {
          void connectMidiInput(activeDevice.id).catch((error: unknown) => {
            console.error('Unable to reconnect MIDI input', error)
            state.setActiveDevice(computerKeyboardDevice.id)
            state.setStatus('error')
          })
        }
      })
      .catch((error: unknown) => console.error('Unable to initialize MIDI input', error))
    return () => {
      cancelled = true
      unlisten()
    }
  }, [setMidiDevices])

  return children
}
