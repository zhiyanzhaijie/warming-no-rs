import { memo, useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import { blackKeyLengthRatio, visibleWhiteKeyLengthRatio } from './pianoGeometry'
import type { PianoKeyLayout } from './pianoGeometry'
import type { PianoKeyState } from './pianoState'

export type PianoKeyboardHandle = {
  applyKeyStates: (changes: ReadonlyMap<number, PianoKeyState>) => void
  reset: () => void
}

export const PianoKeyboard = memo(function PianoKeyboard({
  ref,
  keyLabels,
  keys,
  width,
}: {
  ref?: Ref<PianoKeyboardHandle>
  keyLabels?: ReadonlyMap<number, string>
  keys: readonly PianoKeyLayout[]
  width: number
}) {
  const [keyStates, setKeyStates] = useState<ReadonlyMap<number, PianoKeyState>>(() => new Map())
  const whiteKeys = keys.filter((key) => !key.isBlack)
  const blackKeys = keys.filter((key) => key.isBlack)

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
      className="relative isolate w-full shrink-0 overflow-hidden border-t border-border bg-card [contain:paint]"
      style={{
        aspectRatio: `${whiteKeys.length} / ${visibleWhiteKeyLengthRatio}`,
        width: `${width}px`,
      }}
    >
      {whiteKeys.map((key) => (
        <PianoKey
          key={key.pitch}
          geometry={key}
          state={keyStates.get(key.pitch) ?? 'idle'}
          label={keyLabels?.get(key.pitch)}
        />
      ))}
      {blackKeys.map((key) => (
        <PianoKey
          key={key.pitch}
          geometry={key}
          state={keyStates.get(key.pitch) ?? 'idle'}
          label={keyLabels?.get(key.pitch)}
        />
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
  label,
}: {
  geometry: PianoKeyLayout
  state: PianoKeyState
  label?: string
}) {
  const { isBlack, leftPx, widthPx } = geometry
  return (
    <div
      className={cn(
        'absolute [contain:paint]',
        isBlack
          ? 'top-0 z-10 bg-[#070707] shadow-[0_3px_6px_rgba(0,0,0,0.55),inset_0_-8px_12px_rgba(255,255,255,0.07)]'
          : 'inset-y-0 border-r border-[#aaa] bg-[#f1f1f1] shadow-[inset_0_-8px_14px_rgba(0,0,0,0.14)] first:border-l',
        state === 'active' && (isBlack ? 'bg-[#159447]' : 'bg-spotify-green'),
        state === 'incorrect' && (isBlack ? 'bg-[#343434]' : 'bg-[#8f8f8f]'),
      )}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        height: isBlack ? `${blackKeyLengthRatio * 100}%` : '100%',
      }}
    >
      {state === 'guided' ? (
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 size-[clamp(4px,0.55vw,8px)] -translate-x-1/2 rounded-full bg-spotify-green',
            label
              ? isBlack
                ? 'bottom-[35%]'
                : 'bottom-[25%]'
              : isBlack
                ? 'bottom-[18%]'
                : 'bottom-[14%]',
          )}
        />
      ) : null}
      {label ? (
        <span
          className={cn(
            'pointer-events-none absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[clamp(7px,0.65vw,10px)] font-bold leading-none',
            isBlack ? 'text-white/75' : 'text-black/55',
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  )
})
