import { memo, useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import {
  blackKeyLengthRatio,
  blackPianoKeys,
  visibleWhiteKeyLengthRatio,
  whitePianoKeys,
} from './pianoGeometry'
import type { PianoKeyGeometry } from './pianoGeometry'
import type { PianoKeyState } from './pianoState'

export type PianoKeyboardHandle = {
  applyKeyStates: (changes: ReadonlyMap<number, PianoKeyState>) => void
  reset: () => void
}

export const PianoKeyboard = memo(function PianoKeyboard({
  ref,
}: {
  ref?: Ref<PianoKeyboardHandle>
}) {
  const [keyStates, setKeyStates] = useState<ReadonlyMap<number, PianoKeyState>>(() => new Map())

  useImperativeHandle(
    ref,
    () => ({
      applyKeyStates(changes) {
        setKeyStates((currentStates) => applyChanges(currentStates, changes))
      },
      reset() {
        setKeyStates(new Map())
      },
    }),
    [],
  )

  return (
    <div
      className="relative isolate w-full shrink-0 overflow-hidden rounded-b-[4px] bg-[#080808] [contain:paint]"
      style={{
        aspectRatio: `${whitePianoKeys.length} / ${visibleWhiteKeyLengthRatio}`,
      }}
    >
      {whitePianoKeys.map((key) => (
        <PianoKey key={key.pitch} geometry={key} state={keyStates.get(key.pitch) ?? 'idle'} />
      ))}
      {blackPianoKeys.map((key) => (
        <PianoKey key={key.pitch} geometry={key} state={keyStates.get(key.pitch) ?? 'idle'} />
      ))}
    </div>
  )
})

function applyChanges(
  currentStates: ReadonlyMap<number, PianoKeyState>,
  changes: ReadonlyMap<number, PianoKeyState>,
) {
  const nextStates = new Map(currentStates)
  for (const [pitch, state] of changes) {
    if (state === 'idle') nextStates.delete(pitch)
    else nextStates.set(pitch, state)
  }
  return nextStates
}

const PianoKey = memo(function PianoKey({
  geometry,
  state,
}: {
  geometry: PianoKeyGeometry
  state: PianoKeyState
}) {
  const { isBlack, leftPercent, widthPercent } = geometry
  return (
    <div
      className={cn(
        'absolute rounded-b-[3px] [contain:paint]',
        isBlack
          ? 'top-0 z-10 bg-[#070707] shadow-[0_3px_6px_rgba(0,0,0,0.55),inset_0_-8px_12px_rgba(255,255,255,0.07)]'
          : 'inset-y-0 border-r border-[#aaa] bg-[#f1f1f1] shadow-[inset_0_-8px_14px_rgba(0,0,0,0.14)] first:border-l',
        state === 'active' && (isBlack ? 'bg-[#159447]' : 'bg-spotify-green'),
        state === 'incorrect' && (isBlack ? 'bg-[#343434]' : 'bg-[#8f8f8f]'),
      )}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        height: isBlack ? `${blackKeyLengthRatio * 100}%` : '100%',
      }}
    >
      {state === 'guided' ? (
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 size-[clamp(4px,0.55vw,8px)] -translate-x-1/2 rounded-full bg-spotify-green',
            isBlack ? 'bottom-[18%]' : 'bottom-[14%]',
          )}
        />
      ) : null}
    </div>
  )
})
