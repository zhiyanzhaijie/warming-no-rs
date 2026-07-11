import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import type { PieceScore, ScoreNote } from '../../shared/types/domain'
import { buildMeasureTimings, parseBeatsPerMeasure } from '../practice/measureTiming'
import { usePracticeStore } from '../practice/practiceStore'
import { cn } from '@/lib/utils'
import { PianoKeyboard } from './PianoKeyboard'
import type { PianoKeyboardHandle } from './PianoKeyboard'
import { buildPitchGuides, keyGeometryForPitch } from './pianoGeometry'
import type { PianoKeyGeometry } from './pianoGeometry'
import type { PianoKeyState } from './pianoState'

type FallingNotesProps = {
  score?: PieceScore
}

type PreparedNote = ScoreNote & {
  key: PianoKeyGeometry
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

const octaveGuides = buildPitchGuides(0)
const innerPitchGuides = buildPitchGuides(5)
const beatLabelIntervalMs = 250
const visibleMeasureCount = 1.5
const renderAheadMeasureCount = 8
const renderBehindMeasureCount = 2
const audioScheduleAheadSeconds = 0.12
const audioAttackSeconds = 0.008
const audioReleaseSeconds = 0.035
const silentGain = 0.0001

export function FallingNotes({ score }: FallingNotesProps) {
  const bpm = usePracticeStore((state) => state.bpm)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const seekRequest = usePracticeStore((state) => state.seekRequest)
  const setCurrentBeat = usePracticeStore((state) => state.setCurrentBeat)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(88)
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
  const nextNoteIndexRef = useRef(0)
  const nextKeyEventIndexRef = useRef(0)
  const activePitchCountsRef = useRef<Map<number, number>>(new Map())
  const audioRef = useRef<AudioContext | null>(null)
  const activeOscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map())

  const notes = useMemo(
    () => (score?.notes ?? []).toSorted((a, b) => a.startBeat - b.startBeat),
    [score?.notes],
  )
  const pianoKeyEvents = useMemo(() => buildPianoKeyEvents(notes), [notes])
  const beatsPerMeasure = useMemo(
    () => parseBeatsPerMeasure(score?.timeSignature ?? '4/4'),
    [score?.timeSignature],
  )
  const renderWindowBeat = renderWindow.pieceId === score?.pieceId ? renderWindow.beat : 0
  const renderStartBeat = Math.max(0, renderWindowBeat - beatsPerMeasure * renderBehindMeasureCount)
  const renderEndBeat = renderWindowBeat + beatsPerMeasure * renderAheadMeasureCount
  const preparedNotes = useMemo(
    () => prepareNotes(notes, pixelsPerBeat, renderStartBeat, renderEndBeat),
    [notes, pixelsPerBeat, renderEndBeat, renderStartBeat],
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

  useEffect(() => {
    if (!isPlaying) {
      lastFrameAtRef.current = null
      stopAll(activeOscillatorsRef.current)
      return
    }

    let frame = 0
    const tick = (now: number) => {
      const lastFrameAt = lastFrameAtRef.current ?? now
      const elapsedSeconds = (now - lastFrameAt) / 1000
      lastFrameAtRef.current = now

      const nextBeat = currentBeatRef.current + (elapsedSeconds * bpmRef.current) / 60
      currentBeatRef.current = nextBeat

      updateTimelineTransform(
        timelineRef.current,
        nextBeat,
        renderStartBeatRef.current,
        pixelsPerBeatRef.current,
      )
      playDueNotes(notes, nextBeat, bpmRef.current, audioRef, activeOscillatorsRef, nextNoteIndexRef)
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
          beatLabelRef.current.textContent = `${Math.round(nextBeat)} / ${Math.ceil(totalBeatsRef.current)} beats`
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
  }, [isPlaying, notes, pianoKeyEvents, score?.pieceId, setCurrentBeat, startRenderTransition])

  useEffect(() => {
    currentBeatRef.current = 0
    nextNoteIndexRef.current = 0
    nextKeyEventIndexRef.current = 0
    activePitchCountsRef.current.clear()
    lastFrameAtRef.current = null
    setCurrentBeat(0)
    setRenderWindow({ pieceId: score?.pieceId, beat: 0 })
    pianoKeyboardRef.current?.reset()
    stopAll(activeOscillatorsRef.current)
  }, [score?.pieceId, setCurrentBeat])

  useLayoutEffect(() => {
    if (!seekRequest || seekRequest.pieceId !== score?.pieceId) return

    const targetBeat = Math.max(0, Math.min(seekRequest.beat, score?.totalBeats ?? 0))
    currentBeatRef.current = targetBeat
    lastFrameAtRef.current = null
    nextNoteIndexRef.current = lowerBoundNoteStart(notes, targetBeat)
    nextKeyEventIndexRef.current = 0
    activePitchCountsRef.current.clear()
    pianoKeyboardRef.current?.reset()
    processPianoKeyEvents(
      pianoKeyEvents,
      targetBeat,
      nextKeyEventIndexRef,
      activePitchCountsRef,
      pianoKeyboardRef.current,
    )
    stopAll(activeOscillatorsRef.current)
    if (isPlayingRef.current) {
      scheduleSustainingNotesAtSeek(
        notes,
        targetBeat,
        bpmRef.current,
        audioRef,
        activeOscillatorsRef,
      )
    }
    setCurrentBeat(targetBeat)
    if (beatLabelRef.current) {
      beatLabelRef.current.textContent = `${Math.round(targetBeat)} / ${Math.ceil(score?.totalBeats ?? 0)} beats`
    }
    setRenderWindow({
      pieceId: score?.pieceId,
      beat: Math.floor(targetBeat / beatsPerMeasure) * beatsPerMeasure,
    })
  }, [beatsPerMeasure, notes, pianoKeyEvents, score?.pieceId, score?.totalBeats, seekRequest, setCurrentBeat])

  useLayoutEffect(() => {
    updateTimelineTransform(timelineRef.current, currentBeatRef.current, renderStartBeat, pixelsPerBeat)
  }, [pixelsPerBeat, preparedNotes.length, renderStartBeat, score?.pieceId])

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-card">
      <div
        ref={noteViewportRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-t-lg bg-card [contain:paint] [isolation:isolate]"
      >
        <div className="absolute left-4 top-4 z-20 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[1.4px] text-muted-foreground">
          {score ? (
            <>
              {score.title} · <span ref={beatLabelRef}>0 / {Math.ceil(score.totalBeats)} beats</span>
            </>
          ) : (
            'No MIDI score'
          )}
        </div>

        <div
          className="absolute inset-0 overflow-hidden"
        >
          {octaveGuides.map((guide) => (
            <div
              key={`octave-${guide.pitch}`}
              className="absolute inset-y-0 z-0 w-px bg-spotify-green/30 shadow-[0_0_12px_rgba(30,215,96,0.12)]"
              style={{ left: `${guide.leftPercent}%` }}
            />
          ))}

          {innerPitchGuides.map((guide) => (
            <div
              key={`inner-${guide.pitch}`}
              className="absolute inset-y-0 z-0 w-px bg-white/8"
              style={{ left: `${guide.leftPercent}%` }}
            />
          ))}

          <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-spotify-green/80 shadow-[0_0_24px_rgba(30,215,96,0.65)]" />

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
                className={cn('absolute rounded-t-[3px]', note.colorClassName)}
                style={initialNoteStyle(note, renderStartBeat, pixelsPerBeat)}
              />
            ))}
          </div>
        </div>
      </div>

      <PianoKeyboard ref={pianoKeyboardRef} />
    </section>
  )
}

function prepareNotes(
  notes: ScoreNote[],
  pixelsPerBeat: number,
  renderStartBeat: number,
  renderEndBeat: number,
): PreparedNote[] {
  const preparedNotes: PreparedNote[] = []
  for (const note of notes) {
    if (note.startBeat >= renderEndBeat) break
    if (note.startBeat + note.durationBeats <= renderStartBeat) continue

    const key = keyGeometryForPitch(note.pitch)
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
    left: `${note.key.leftPercent}%`,
    bottom: `${(note.startBeat - renderStartBeat) * pixelsPerBeat}px`,
    height: `${note.height}px`,
    width: `${note.key.widthPercent}%`,
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

function playDueNotes(
  notes: ScoreNote[],
  currentBeat: number,
  bpm: number,
  audioRef: MutableRefObject<AudioContext | null>,
  activeRef: MutableRefObject<Map<string, OscillatorNode>>,
  nextNoteIndexRef: MutableRefObject<number>,
) {
  if (notes.length === 0) return
  const audio = audioRef.current ?? new AudioContext()
  audioRef.current = audio
  if (audio.state === 'suspended') {
    void audio.resume()
  }

  const scheduleAheadBeats = (audioScheduleAheadSeconds * bpm) / 60
  while (
    nextNoteIndexRef.current < notes.length &&
    notes[nextNoteIndexRef.current].startBeat <= currentBeat + scheduleAheadBeats
  ) {
    const note = notes[nextNoteIndexRef.current]
    nextNoteIndexRef.current += 1
    const endBeat = note.startBeat + note.durationBeats
    if (currentBeat > endBeat || activeRef.current.has(note.id)) {
      continue
    }

    scheduleNote(audio, note, currentBeat, bpm, activeRef)
  }
}

function scheduleNote(
  audio: AudioContext,
  note: ScoreNote,
  currentBeat: number,
  bpm: number,
  activeRef: MutableRefObject<Map<string, OscillatorNode>>,
) {
  const startDelay = Math.max(0, ((note.startBeat - currentBeat) * 60) / bpm)
  const duration = remainingSeconds(note, Math.max(currentBeat, note.startBeat), bpm)
  const startAt = audio.currentTime + startDelay
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  const sustainGain = Math.max(0.04, Math.min(0.22, note.velocity / 480))
  const endAt = startAt + duration
  const envelopeSeconds = audioAttackSeconds + audioReleaseSeconds

  oscillator.type = 'sine'
  oscillator.frequency.value = midiToFrequency(note.pitch)
  gain.gain.setValueAtTime(silentGain, startAt)
  if (duration <= envelopeSeconds) {
    gain.gain.linearRampToValueAtTime(sustainGain, startAt + duration / 2)
  } else {
    const attackEndAt = startAt + audioAttackSeconds
    const releaseStartAt = endAt - audioReleaseSeconds
    gain.gain.linearRampToValueAtTime(sustainGain, attackEndAt)
    gain.gain.setValueAtTime(sustainGain, releaseStartAt)
  }
  gain.gain.exponentialRampToValueAtTime(silentGain, endAt)
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(startAt)
  oscillator.stop(endAt)
  oscillator.onended = () => activeRef.current.delete(note.id)
  activeRef.current.set(note.id, oscillator)
}

function remainingSeconds(note: ScoreNote, currentBeat: number, bpm: number) {
  return Math.max(0.05, ((note.startBeat + note.durationBeats - currentBeat) * 60) / bpm)
}

function midiToFrequency(pitch: number) {
  return 440 * 2 ** ((pitch - 69) / 12)
}

function stopAll(active: Map<string, OscillatorNode>) {
  for (const oscillator of active.values()) {
    try {
      oscillator.stop()
    } catch {
      // already stopped
    }
  }
  active.clear()
}

function buildMeasureGuides(totalBeats: number, timeSignature: string): MeasureGuide[] {
  return buildMeasureTimings(totalBeats, timeSignature)
}

function buildPianoKeyEvents(notes: ScoreNote[]): PianoKeyEvent[] {
  const events: PianoKeyEvent[] = []
  for (const note of notes) {
    if (!keyGeometryForPitch(note.pitch)) continue
    events.push({ beat: note.startBeat, pitch: note.pitch, delta: 1 })
    events.push({ beat: note.startBeat + note.durationBeats, pitch: note.pitch, delta: -1 })
  }
  return events.toSorted((first, second) => first.beat - second.beat || second.delta - first.delta)
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

function lowerBoundNoteStart(notes: ScoreNote[], targetBeat: number) {
  let low = 0
  let high = notes.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (notes[middle].startBeat < targetBeat) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function scheduleSustainingNotesAtSeek(
  notes: ScoreNote[],
  targetBeat: number,
  bpm: number,
  audioRef: MutableRefObject<AudioContext | null>,
  activeRef: MutableRefObject<Map<string, OscillatorNode>>,
) {
  const sustainingNotes: ScoreNote[] = []
  for (const note of notes) {
    if (note.startBeat >= targetBeat) break
    if (note.startBeat + note.durationBeats > targetBeat) sustainingNotes.push(note)
  }
  if (sustainingNotes.length === 0) return

  const audio = audioRef.current ?? new AudioContext()
  audioRef.current = audio
  for (const note of sustainingNotes) {
    scheduleNote(audio, note, targetBeat, bpm, activeRef)
  }
}
