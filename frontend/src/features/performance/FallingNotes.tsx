import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import type { PieceScore, ScoreNote } from '../../shared/types/domain'
import { instrumentOutput, type MidiEvent } from '../../api/instrument'
import { useComputerKeyboard } from '../instrument/useComputerKeyboard'
import { computerKeyboardLabelByPitch } from '../instrument/computerKeyboardLayout'
import { pianoInputBus } from '../instrument/input/PianoInputBus'
import { useInstrumentStore } from '../instrument/input/instrumentStore'
import type { PianoInputEvent } from '../instrument/input/types'
import { buildMeasureTimings, parseBeatsPerMeasure } from '../practice/measureTiming'
import { PracticeEngine, selectAutoPlayNotes } from '../practice/PracticeEngine'
import { usePracticeStore } from '../practice/practiceStore'
import { cn } from '@/lib/utils'
import { PianoKeyboard } from './PianoKeyboard'
import type { PianoKeyboardHandle } from './PianoKeyboard'
import { buildPianoKeyGeometry, layoutPianoKeys } from './pianoGeometry'
import type { PianoKeyLayout } from './pianoGeometry'
import type { PianoKeyState } from './pianoState'

type FallingNotesProps = {
  score?: PieceScore
}

type PreparedNote = ScoreNote & {
  key: PianoKeyLayout
  height: number
  opacity: number
  colorClassName: string
}

type MeasureGuide = {
  number: number
  startBeat: number
}

type PianoKeyEvent = {
  beat: number
  pitch: number
  delta: 1 | -1
}

type PlaybackMidiEvent = {
  beat: number
  event: MidiEvent
}

const beatLabelIntervalMs = 250
const visibleMeasureCount = 1.5
const renderAheadMeasureCount = 8
const renderBehindMeasureCount = 2

export function FallingNotes({ score }: FallingNotesProps) {
  const bpm = usePracticeStore((state) => state.bpm)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const loopEnabled = usePracticeStore((state) => state.loopEnabled)
  const loopRange = usePracticeStore((state) => state.loopRange)
  const mode = usePracticeStore((state) => state.mode)
  const seekRequest = usePracticeStore((state) => state.seekRequest)
  const setCurrentBeat = usePracticeStore((state) => state.setCurrentBeat)
  const pausePlayback = usePracticeStore((state) => state.pausePlayback)
  const inputDevices = useInstrumentStore((state) => state.devices)
  const activeDeviceId = useInstrumentStore((state) => state.activeDeviceId)
  const activeInputDevice = inputDevices.find((device) => device.id === activeDeviceId) ?? inputDevices[0]
  const inputRange = deviceRange(activeInputDevice) ?? ([21, 108] as const)
  const rangeStart = inputRange[0]
  const rangeEnd = inputRange[1]
  const activePianoKeys = useMemo(
    () => buildPianoKeyGeometry(rangeStart, rangeEnd),
    [rangeEnd, rangeStart],
  )
  const [pixelsPerBeat, setPixelsPerBeat] = useState(88)
  const [horizontalTrackWidth, setHorizontalTrackWidth] = useState(0)
  const [renderWindow, setRenderWindow] = useState({ pieceId: score?.pieceId, beat: 0 })
  const [, startRenderTransition] = useTransition()
  const noteViewportRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const beatLabelRef = useRef<HTMLSpanElement | null>(null)
  const pianoKeyboardRef = useRef<PianoKeyboardHandle | null>(null)
  const currentBeatRef = useRef(0)
  const bpmRef = useRef(bpm)
  const isPlayingRef = useRef(isPlaying)
  const pixelsPerBeatRef = useRef(pixelsPerBeat)
  const beatsPerMeasureRef = useRef(4)
  const renderStartBeatRef = useRef(0)
  const renderWindowBeatRef = useRef(0)
  const totalBeatsRef = useRef(0)
  const renderTransitionPendingRef = useRef(false)
  const lastFrameAtRef = useRef<number | null>(null)
  const lastBeatLabelAtRef = useRef(0)
  const nextMidiEventIndexRef = useRef(0)
  const nextKeyEventIndexRef = useRef(0)
  const practiceEngineRef = useRef<PracticeEngine | null>(null)
  if (practiceEngineRef.current === null) practiceEngineRef.current = new PracticeEngine()
  const activePitchCountsRef = useRef<Map<number, number>>(new Map())

  const pianoKeyLayout = useMemo(
    () => layoutPianoKeys(activePianoKeys, horizontalTrackWidth),
    [activePianoKeys, horizontalTrackWidth],
  )
  const activeKeyByPitch = useMemo(
    () => new Map(pianoKeyLayout.map((key) => [key.pitch, key])),
    [pianoKeyLayout],
  )
  const octaveGuides = useMemo(
    () => pianoKeyLayout.filter((key) => key.pitch % 12 === 0 && !key.isBlack),
    [pianoKeyLayout],
  )
  const innerPitchGuides = useMemo(
    () => pianoKeyLayout.filter((key) => key.pitch % 12 === 5 && !key.isBlack),
    [pianoKeyLayout],
  )

  const notes = useMemo(
    () => (score?.notes ?? []).toSorted((a, b) => a.startBeat - b.startBeat),
    [score?.notes],
  )
  const autoPlayNotes = useMemo(() => selectAutoPlayNotes(notes, mode), [mode, notes])
  const pianoKeyEvents = useMemo(
    () => buildPianoKeyEvents(autoPlayNotes, activeKeyByPitch),
    [activeKeyByPitch, autoPlayNotes],
  )
  const midiEvents = useMemo(() => buildMidiPlaybackEvents(autoPlayNotes), [autoPlayNotes])
  const handleUserNoteOn = useCallback((pitch: number) => {
    practiceEngineRef.current?.receiveNoteOn(pitch)
  }, [])
  const handleInputEvent = useEffectEvent((event: PianoInputEvent) => {
    handlePianoInput(
      event,
      pianoKeyboardRef.current,
      inputEnabled ? handleUserNoteOn : undefined,
    )
  })
  const inputEnabled = mode === 'free' || (mode !== 'listen' && isPlaying)
  useComputerKeyboard(inputEnabled && activeInputDevice.kind === 'computer-keyboard')
  useEffect(() => {
    return pianoInputBus.subscribe(handleInputEvent)
  }, [])
  const beatsPerMeasure = useMemo(
    () => parseBeatsPerMeasure(score?.timeSignature ?? '4/4'),
    [score?.timeSignature],
  )
  useLayoutEffect(() => {
    practiceEngineRef.current?.configure(notes, mode)
  }, [mode, notes])
  const renderWindowBeat = renderWindow.pieceId === score?.pieceId ? renderWindow.beat : 0
  const renderStartBeat = Math.max(0, renderWindowBeat - beatsPerMeasure * renderBehindMeasureCount)
  const renderEndBeat = renderWindowBeat + beatsPerMeasure * renderAheadMeasureCount
  const preparedNotes = useMemo(
    () => prepareNotes(notes, pixelsPerBeat, renderStartBeat, renderEndBeat, activeKeyByPitch),
    [activeKeyByPitch, notes, pixelsPerBeat, renderEndBeat, renderStartBeat],
  )
  const measureGuides = useMemo(
    () =>
      buildMeasureGuides(score?.totalBeats ?? 0, score?.timeSignature ?? '4/4').filter(
        (measure) => measure.startBeat >= renderStartBeat && measure.startBeat < renderEndBeat,
      ),
    [renderEndBeat, renderStartBeat, score?.timeSignature, score?.totalBeats],
  )

  useEffect(() => {
    const viewport = noteViewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver(([entry]) => {
      const nextPixelsPerBeat = entry.contentRect.height / (beatsPerMeasure * visibleMeasureCount)
      setPixelsPerBeat(Math.max(1, nextPixelsPerBeat))
      setHorizontalTrackWidth(entry.contentRect.width)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [beatsPerMeasure])

  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useLayoutEffect(() => {
    pixelsPerBeatRef.current = pixelsPerBeat
    beatsPerMeasureRef.current = beatsPerMeasure
    renderStartBeatRef.current = renderStartBeat
    renderWindowBeatRef.current = renderWindowBeat
    totalBeatsRef.current = score?.totalBeats ?? 0
    renderTransitionPendingRef.current = false
  }, [beatsPerMeasure, pixelsPerBeat, renderStartBeat, renderWindowBeat, score?.totalBeats])

  const synchronizePosition = useEffectEvent((targetBeat: number, resumeAudio: boolean) => {
    currentBeatRef.current = targetBeat
    lastFrameAtRef.current = null
    nextMidiEventIndexRef.current = upperBoundMidiEvent(midiEvents, targetBeat)
    nextKeyEventIndexRef.current = 0
    practiceEngineRef.current?.reset(targetBeat)
    activePitchCountsRef.current.clear()
    pianoKeyboardRef.current?.reset()
    processPianoKeyEvents(
      pianoKeyEvents,
      targetBeat,
      nextKeyEventIndexRef,
      activePitchCountsRef,
      pianoKeyboardRef.current,
    )
    setCurrentBeat(targetBeat)
    if (beatLabelRef.current) {
      beatLabelRef.current.textContent = `${Math.round(targetBeat)} / ${Math.ceil(score?.totalBeats ?? 0)} 拍`
    }
    const windowBeat = Math.floor(targetBeat / beatsPerMeasure) * beatsPerMeasure
    setRenderWindow({ pieceId: score?.pieceId, beat: windowBeat })
    // Keep the current DOM in its existing coordinate system until React
    // commits the newly prepared render window.
    updateTimelineTransform(
      timelineRef.current,
      targetBeat,
      renderStartBeatRef.current,
      pixelsPerBeatRef.current,
    )
    restartInstrument(
      resumeAudio ? buildActiveMidiEventsAtBeat(autoPlayNotes, targetBeat) : [],
    )
  })

  useEffect(() => {
    if (!isPlaying) {
      lastFrameAtRef.current = null
      practiceEngineRef.current?.reset(currentBeatRef.current)
      stopInstrument()
      return
    }

    if (currentBeatRef.current >= (score?.totalBeats ?? 0)) {
      synchronizePosition(loopEnabled && loopRange ? loopRange.startBeat : 0, true)
    } else {
      restartInstrument(buildActiveMidiEventsAtBeat(autoPlayNotes, currentBeatRef.current))
    }

    let frame = 0
    const tick = (now: number) => {
      const lastFrameAt = lastFrameAtRef.current ?? now
      const elapsedSeconds = (now - lastFrameAt) / 1000
      lastFrameAtRef.current = now

      let nextBeat = currentBeatRef.current + (elapsedSeconds * bpmRef.current) / 60
      if (mode !== 'listen') {
        const frame = practiceEngineRef.current!.advance(nextBeat)
        nextBeat = frame.beat
        if (frame.target) {
          pianoKeyboardRef.current?.applyKeyStates(
            new Map(Array.from(frame.target.pitches, (pitch) => [pitch, 'guided' as PianoKeyState])),
          )
        }
      }

      if (
        loopEnabled &&
        loopRange &&
        (nextBeat < loopRange.startBeat || nextBeat >= loopRange.endBeat)
      ) {
        nextBeat = loopRange.startBeat
        synchronizePosition(nextBeat, true)
      } else if (nextBeat >= totalBeatsRef.current) {
        nextBeat = totalBeatsRef.current
        currentBeatRef.current = nextBeat
        updateTimelineTransform(
          timelineRef.current,
          nextBeat,
          renderStartBeatRef.current,
          pixelsPerBeatRef.current,
        )
        setCurrentBeat(nextBeat)
        pausePlayback()
        return
      }
      currentBeatRef.current = nextBeat

      updateTimelineTransform(
        timelineRef.current,
        nextBeat,
        renderStartBeatRef.current,
        pixelsPerBeatRef.current,
      )
      processMidiPlaybackEvents(midiEvents, nextBeat, nextMidiEventIndexRef)
      processPianoKeyEvents(
        pianoKeyEvents,
        nextBeat,
        nextKeyEventIndexRef,
        activePitchCountsRef,
        pianoKeyboardRef.current,
      )

      if (now - lastBeatLabelAtRef.current >= beatLabelIntervalMs) {
        lastBeatLabelAtRef.current = now
        if (beatLabelRef.current) {
          beatLabelRef.current.textContent = `${Math.round(nextBeat)} / ${Math.ceil(totalBeatsRef.current)} 拍`
        }
        setCurrentBeat(nextBeat)

        if (
          !renderTransitionPendingRef.current &&
          nextBeat >= renderWindowBeatRef.current + beatsPerMeasureRef.current * 2
        ) {
          renderTransitionPendingRef.current = true
          startRenderTransition(() => {
            setRenderWindow({
              pieceId: score?.pieceId,
              beat: Math.floor(nextBeat / beatsPerMeasureRef.current) * beatsPerMeasureRef.current,
            })
          })
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      lastFrameAtRef.current = null
    }
  }, [autoPlayNotes, isPlaying, loopEnabled, loopRange, midiEvents, mode, notes, pausePlayback, pianoKeyEvents, score?.pieceId, score?.totalBeats, setCurrentBeat, startRenderTransition])

  useLayoutEffect(() => {
    synchronizePosition(0, false)
  }, [mode, score?.pieceId, setCurrentBeat])

  useLayoutEffect(() => {
    if (!seekRequest || seekRequest.pieceId !== score?.pieceId) return

    const targetBeat = Math.max(0, Math.min(seekRequest.beat, score?.totalBeats ?? 0))
    synchronizePosition(targetBeat, isPlayingRef.current)
  }, [autoPlayNotes, beatsPerMeasure, midiEvents, notes, pianoKeyEvents, score?.pieceId, score?.totalBeats, seekRequest, setCurrentBeat])

  useLayoutEffect(() => {
    updateTimelineTransform(timelineRef.current, currentBeatRef.current, renderStartBeat, pixelsPerBeat)
  }, [pixelsPerBeat, preparedNotes.length, renderStartBeat, score?.pieceId])

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[#030303]">
      <div
        ref={noteViewportRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[#030303] [contain:paint] [isolation:isolate]"
      >
        <div className="absolute left-5 top-4 z-20 border-l border-white/20 pl-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30 lg:left-8">
          {score ? (
            <>
              时间轴 · <span ref={beatLabelRef}>0 / {Math.ceil(score.totalBeats)} 拍</span>
            </>
          ) : (
            '暂无可用曲谱'
          )}
        </div>

        <div
          className="absolute inset-0 overflow-hidden"
        >
          {octaveGuides.map((guide) => (
            <div
              key={`octave-${guide.pitch}`}
              className="absolute inset-y-0 z-0 w-px bg-white/10"
              style={{ left: `${guide.leftPx}px` }}
            />
          ))}

          {innerPitchGuides.map((guide) => (
            <div
              key={`inner-${guide.pitch}`}
              className="absolute inset-y-0 z-0 w-px bg-white/8"
              style={{ left: `${guide.leftPx}px` }}
            />
          ))}

          <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-primary/80 shadow-[0_0_18px_rgba(30,215,96,0.35)]" />

          <div
            ref={timelineRef}
            className="absolute inset-x-0 bottom-0 [contain:paint] will-change-transform transform-gpu"
            style={{ height: `${(renderEndBeat - renderStartBeat) * pixelsPerBeat}px` }}
          >
            {measureGuides.map((measure) => (
              <div
                key={measure.number}
                className="absolute inset-x-0 z-0 h-px bg-white/8"
                style={{ bottom: `${(measure.startBeat - renderStartBeat) * pixelsPerBeat}px` }}
              >
                <span className="absolute bottom-1 left-1 text-[9px] font-bold tracking-[1px] text-white/30">
                  {measure.number}
                </span>
              </div>
            ))}

            {preparedNotes.map((note) => (
              <div
                key={note.id}
                className={cn('absolute', note.colorClassName)}
                style={initialNoteStyle(note, renderStartBeat, pixelsPerBeat)}
              />
            ))}
          </div>
        </div>
      </div>

      <PianoKeyboard
        ref={pianoKeyboardRef}
        keyLabels={
          mode !== 'listen' && activeInputDevice.kind === 'computer-keyboard'
            ? computerKeyboardLabelByPitch
            : undefined
        }
        keys={pianoKeyLayout}
        width={horizontalTrackWidth}
      />
    </section>
  )
}

function handlePianoInput(
  event: PianoInputEvent,
  keyboard: PianoKeyboardHandle | null,
  onNoteOn?: (pitch: number) => void,
) {
  const sendInputEvents = event.sourceId === 'computer-keyboard-61'
    ? sendComputerKeyboardEvents
    : sendPhysicalMidiEvents
  if (event.type === 'noteOn') {
    keyboard?.applyKeyStates(new Map([[event.pitch, 'active']]))
    onNoteOn?.(event.pitch)
    sendInputEvents([{ type: 'noteOn', channel: event.channel, note: event.pitch, velocity: event.velocity }])
  } else if (event.type === 'noteOff') {
    keyboard?.applyKeyStates(new Map([[event.pitch, 'idle']]))
    sendInputEvents([{ type: 'noteOff', channel: event.channel, note: event.pitch, velocity: event.velocity }])
  } else {
    sendInputEvents([{ type: 'controlChange', channel: event.channel, controller: event.controller, value: event.value }])
  }
}

function deviceRange(device: { lowestPitch: number | null; highestPitch: number | null }) {
  return device.lowestPitch !== null && device.highestPitch !== null
    ? ([device.lowestPitch, device.highestPitch] as const)
    : undefined
}

function prepareNotes(
  notes: ScoreNote[],
  pixelsPerBeat: number,
  renderStartBeat: number,
  renderEndBeat: number,
  keyByPitch: ReadonlyMap<number, PianoKeyLayout>,
): PreparedNote[] {
  const preparedNotes: PreparedNote[] = []
  for (const note of notes) {
    if (note.startBeat >= renderEndBeat) break
    if (note.startBeat + note.durationBeats <= renderStartBeat) continue

    const key = keyByPitch.get(note.pitch)
    if (!key) continue

    preparedNotes.push({
      ...note,
      key,
      height: Math.max(2, note.durationBeats * pixelsPerBeat),
      opacity: Math.min(1, 0.5 + note.velocity / 150),
      colorClassName: key.isBlack
        ? 'bg-[#0b7a34]'
        : 'bg-[#35dc71]',
    })
  }
  return preparedNotes
}

function initialNoteStyle(
  note: PreparedNote,
  renderStartBeat: number,
  pixelsPerBeat: number,
): CSSProperties {
  return {
    left: `${note.key.leftPx}px`,
    bottom: `${(note.startBeat - renderStartBeat) * pixelsPerBeat}px`,
    height: `${note.height}px`,
    width: `${note.key.widthPx}px`,
    opacity: note.opacity,
  }
}

function updateTimelineTransform(
  timeline: HTMLDivElement | null,
  currentBeat: number,
  renderStartBeat: number,
  pixelsPerBeat: number,
) {
  if (!timeline) return
  timeline.style.transform = `translate3d(0, ${(currentBeat - renderStartBeat) * pixelsPerBeat}px, 0)`
}

function buildMidiPlaybackEvents(notes: ScoreNote[]) {
  const events: PlaybackMidiEvent[] = []
  for (const note of notes) {
    const channel = midiChannelForNote(note)
    const pitch = Math.max(0, Math.min(127, note.pitch))
    const velocity = Math.max(1, Math.min(127, note.velocity))
    events.push({
      beat: note.startBeat,
      event: { type: 'noteOn', channel, note: pitch, velocity },
    })
    events.push({
      beat: note.startBeat + note.durationBeats,
      event: { type: 'noteOff', channel, note: pitch, velocity: 0 },
    })
  }
  return events.toSorted(
    (first, second) =>
      first.beat - second.beat ||
      Number(first.event.type !== 'noteOff') - Number(second.event.type !== 'noteOff'),
  )
}

function midiChannelForNote(note: ScoreNote) {
  return Number.isInteger(note.channel) && note.channel >= 0 && note.channel <= 15
    ? note.channel
    : 0
}


function processMidiPlaybackEvents(
  events: PlaybackMidiEvent[],
  currentBeat: number,
  nextEventIndexRef: { current: number },
) {
  const due: MidiEvent[] = []
  while (
    nextEventIndexRef.current < events.length &&
    events[nextEventIndexRef.current].beat <= currentBeat
  ) {
    due.push(events[nextEventIndexRef.current].event)
    nextEventIndexRef.current += 1
  }
  sendMidiEvents(due)
}

function sendMidiEvents(events: MidiEvent[]) {
  if (events.length === 0) return
  void instrumentOutput.send(events).catch((error: unknown) => {
    console.error('Unable to send MIDI events', error)
  })
}

function sendPhysicalMidiEvents(events: MidiEvent[]) {
  void instrumentOutput.sendMidiInput(events).catch((error: unknown) => {
    console.error('Unable to send physical MIDI events', error)
  })
}

function sendComputerKeyboardEvents(events: MidiEvent[]) {
  void instrumentOutput.sendComputerInput(events).catch((error: unknown) => {
    console.error('Unable to send computer keyboard events', error)
  })
}

function stopInstrument() {
  void instrumentOutput.stopAll().catch((error: unknown) => {
    console.error('Unable to stop audio output', error)
  })
}

function buildMeasureGuides(totalBeats: number, timeSignature: string): MeasureGuide[] {
  return buildMeasureTimings(totalBeats, timeSignature)
}

function buildPianoKeyEvents(
  notes: ScoreNote[],
  keyByPitch: ReadonlyMap<number, PianoKeyLayout>,
): PianoKeyEvent[] {
  const events: PianoKeyEvent[] = []
  for (const note of notes) {
    if (!keyByPitch.has(note.pitch)) continue
    events.push({ beat: note.startBeat, pitch: note.pitch, delta: 1 })
    events.push({ beat: note.startBeat + note.durationBeats, pitch: note.pitch, delta: -1 })
  }
  return events.toSorted((first, second) => first.beat - second.beat || first.delta - second.delta)
}

function processPianoKeyEvents(
  events: PianoKeyEvent[],
  currentBeat: number,
  nextEventIndexRef: MutableRefObject<number>,
  activePitchCountsRef: MutableRefObject<Map<number, number>>,
  keyboard: PianoKeyboardHandle | null,
) {
  if (!keyboard) return
  const changes = new Map<number, PianoKeyState>()
  while (
    nextEventIndexRef.current < events.length &&
    events[nextEventIndexRef.current].beat <= currentBeat
  ) {
    const event = events[nextEventIndexRef.current]
    nextEventIndexRef.current += 1
    const currentCount = activePitchCountsRef.current.get(event.pitch) ?? 0
    const nextCount = Math.max(0, currentCount + event.delta)
    if (nextCount === 0) {
      activePitchCountsRef.current.delete(event.pitch)
      if (currentCount > 0) changes.set(event.pitch, 'idle')
    } else {
      activePitchCountsRef.current.set(event.pitch, nextCount)
      if (currentCount === 0) changes.set(event.pitch, 'active')
    }
  }
  if (changes.size > 0) keyboard.applyKeyStates(changes)
}

function upperBoundMidiEvent(events: PlaybackMidiEvent[], targetBeat: number) {
  let low = 0
  let high = events.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (events[middle].beat <= targetBeat) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function buildActiveMidiEventsAtBeat(notes: ScoreNote[], targetBeat: number) {
  const events: MidiEvent[] = []
  for (const note of notes) {
    if (note.startBeat > targetBeat) break
    if (note.startBeat + note.durationBeats <= targetBeat) continue
    events.push({
      type: 'noteOn',
      channel: midiChannelForNote(note),
      note: Math.max(0, Math.min(127, note.pitch)),
      velocity: Math.max(1, Math.min(127, note.velocity)),
    })
  }
  return events
}

function restartInstrument(events: MidiEvent[]) {
  void instrumentOutput.restart(events).catch((error: unknown) => {
    console.error('Unable to restart audio output', error)
  })
}
