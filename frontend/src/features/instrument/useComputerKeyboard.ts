import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { instrumentOutput, type MidiEvent } from '../../api/instrument'
import type { PianoKeyboardHandle } from '../performance/PianoKeyboard'
import { computerKeyboardPitchByCode } from './computerKeyboardLayout'

const computerKeyboardVelocity = 100

export function useComputerKeyboard(
  enabled: boolean,
  keyboardRef: RefObject<PianoKeyboardHandle | null>,
  onNoteOn?: (pitch: number) => void,
) {
  const pressedKeysRef = useRef(new Map<string, number>())

  useEffect(() => {
    if (!enabled) return
    const pressedKeys = pressedKeysRef.current

    const send = (events: MidiEvent[]) => {
      void instrumentOutput.send(events).catch((error: unknown) => {
        console.error('Unable to send computer keyboard MIDI event', error)
      })
    }
    const setKeyState = (pitch: number, state: 'active' | 'idle') => {
      keyboardRef.current?.applyKeyStates(new Map([[pitch, state]]))
    }
    const releaseAll = () => {
      if (pressedKeys.size === 0) return
      const events = Array.from(pressedKeys.values(), (pitch): MidiEvent => ({
        type: 'noteOff',
        channel: 0,
        note: pitch,
        velocity: 0,
      }))
      for (const pitch of pressedKeys.values()) setKeyState(pitch, 'idle')
      pressedKeys.clear()
      send(events)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) return
      const pitch = computerKeyboardPitchByCode.get(event.code)
      if (pitch === undefined || pressedKeys.has(event.code)) return
      event.preventDefault()
      pressedKeys.set(event.code, pitch)
      setKeyState(pitch, 'active')
      onNoteOn?.(pitch)
      send([
        {
          type: 'noteOn',
          channel: 0,
          note: pitch,
          velocity: computerKeyboardVelocity,
        },
      ])
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const pitch = pressedKeys.get(event.code)
      if (pitch === undefined) return
      event.preventDefault()
      pressedKeys.delete(event.code)
      setKeyState(pitch, 'idle')
      send([{ type: 'noteOff', channel: 0, note: pitch, velocity: 0 }])
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseAll)
      releaseAll()
    }
  }, [enabled, keyboardRef, onNoteOn])
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
