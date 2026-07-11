import { memo, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import {
  blackKeyLengthRatio,
  blackPianoKeys,
  visibleWhiteKeyLengthRatio,
  whitePianoKeys,
} from './pianoGeometry'
import type { PianoKeyState } from './pianoState'

export type PianoKeyboardHandle = {
  setKeyState: (pitch: number, state: PianoKeyState) => void
  reset: () => void
}

export const PianoKeyboard = memo(function PianoKeyboard({
  ref,
}: {
  ref?: Ref<PianoKeyboardHandle>
}) {
    const keyElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())

    useImperativeHandle(
      ref,
      () => ({
        setKeyState(pitch, state) {
          const element = keyElementsRef.current.get(pitch)
          if (element && element.dataset.state !== state) {
            element.dataset.state = state
          }
        },
        reset() {
          for (const element of keyElementsRef.current.values()) {
            element.dataset.state = 'idle'
          }
        },
      }),
      [],
    )

    return (
      <div
        className="relative w-full shrink-0 overflow-hidden rounded-b-[4px] bg-[#080808] shadow-[0_8px_16px_rgba(0,0,0,0.45)] [contain:layout_paint]"
        style={{
          aspectRatio: `${whitePianoKeys.length} / ${visibleWhiteKeyLengthRatio}`,
        }}
      >
        {whitePianoKeys.map((key) => (
          <PianoKey
            key={key.pitch}
            pitch={key.pitch}
            isBlack={false}
            leftPercent={key.leftPercent}
            widthPercent={key.widthPercent}
            registerElement={registerKeyElement(key.pitch, keyElementsRef.current)}
          />
        ))}
        {blackPianoKeys.map((key) => (
          <PianoKey
            key={key.pitch}
            pitch={key.pitch}
            isBlack
            leftPercent={key.leftPercent}
            widthPercent={key.widthPercent}
            registerElement={registerKeyElement(key.pitch, keyElementsRef.current)}
          />
        ))}
      </div>
    )
  })

const PianoKey = memo(function PianoKey({
  pitch,
  isBlack,
  leftPercent,
  widthPercent,
  registerElement,
}: {
  pitch: number
  isBlack: boolean
  leftPercent: number
  widthPercent: number
  registerElement: (element: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={registerElement}
      data-pitch={pitch}
      data-state="idle"
      className={isBlack ? blackKeyClassName : whiteKeyClassName}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        height: isBlack ? `${blackKeyLengthRatio * 100}%` : '100%',
      }}
    >
      <span
        className={[
          'pointer-events-none absolute left-1/2 hidden size-[clamp(4px,0.55vw,8px)] -translate-x-1/2 rounded-full bg-spotify-green shadow-[0_0_8px_rgba(30,215,96,0.7)] group-data-[state=guided]:block',
          isBlack ? 'bottom-[18%]' : 'bottom-[14%]',
        ].join(' ')}
      />
    </div>
  )
})

const whiteKeyClassName = [
  'group absolute inset-y-0 rounded-b-[3px] border-r border-[#aaa] bg-[#f1f1f1] shadow-[inset_0_-8px_14px_rgba(0,0,0,0.14)] first:border-l [contain:paint]',
  'data-[state=active]:bg-spotify-green data-[state=active]:shadow-[inset_0_-8px_14px_rgba(0,0,0,0.16)]',
  'data-[state=incorrect]:bg-[#9b9b9b] data-[state=incorrect]:saturate-0',
].join(' ')

const blackKeyClassName = [
  'group absolute top-0 z-10 rounded-b-[3px] bg-[#070707] shadow-[0_3px_6px_rgba(0,0,0,0.55),inset_0_-8px_12px_rgba(255,255,255,0.07)] [contain:paint]',
  'data-[state=active]:bg-[#159447] data-[state=active]:shadow-[inset_0_-8px_12px_rgba(0,0,0,0.2)]',
  'data-[state=incorrect]:bg-[#343434] data-[state=incorrect]:saturate-0',
].join(' ')

function registerKeyElement(pitch: number, elements: Map<number, HTMLDivElement>) {
  return (element: HTMLDivElement | null) => {
    if (element) {
      elements.set(pitch, element)
    } else {
      elements.delete(pitch)
    }
  }
}
