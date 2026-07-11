import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import type { PieceScore, ScoreNote } from '../../shared/types/domain'
import { buildMeasureTimings, parseBeatsPerMeasure } from '../practice/measureTiming'
import { usePracticeStore } from '../practice/practiceStore'

type FallingNotesProps = {
  score?: PieceScore
}

type PreparedNote = ScoreNote & {
  key: PianoKeyGeometry
  height: number
  opacity: number
  colorClassName: string
}

type PianoKeyGeometry = {
  pitch: number
  isBlack: boolean
  leftPercent: number
  widthPercent: number
}

type MeasureGuide = {
  number: number
  startBeat: number
}

const keyboardStartPitch = 36
const keyboardKeyCount = 65
const keyboardEndPitch = keyboardStartPitch + keyboardKeyCount - 1
const blackPitchClasses = new Set([1, 3, 6, 8, 10])
const blackKeyWidthRatio = 0.58
const visibleWhiteKeyLengthRatio = 3.6
const blackKeyLengthRatio = 0.64
const pianoKeys = buildPianoKeyGeometry()
const whitePianoKeys = pianoKeys.filter((key) => !key.isBlack)
const blackPianoKeys = pianoKeys.filter((key) => key.isBlack)
const octaveGuides = buildPitchGuides(0)
const innerPitchGuides = buildPitchGuides(5)
const beatLabelIntervalMs = 250
const visibleMeasureCount = 1.5
const renderAheadMeasureCount = 8
const renderBehindMeasureCount = 2
const audioScheduleAheadSeconds = 0.12

export function FallingNotes({ score }: FallingNotesProps) {
  const bpm = usePracticeStore((state) => state.bpm)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const setCurrentBeat = usePracticeStore((state) => state.setCurrentBeat)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(88)
  const [renderWindow, setRenderWindow] = useState({ pieceId: score?.pieceId, beat: 0 })
  const [, startRenderTransition] = useTransition()
  const noteViewportRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const beatLabelRef = useRef<HTMLSpanElement | null>(null)
  const currentBeatRef = useRef(0)
  const bpmRef = useRef(bpm)
  const pixelsPerBeatRef = useRef(pixelsPerBeat)
  const beatsPerMeasureRef = useRef(4)
  const renderStartBeatRef = useRef(0)
  const renderWindowBeatRef = useRef(0)
  const totalBeatsRef = useRef(0)
  const renderTransitionPendingRef = useRef(false)
  const lastFrameAtRef = useRef<number | null>(null)
  const lastBeatLabelAtRef = useRef(0)
  const nextNoteIndexRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const activeOscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map())

  const notes = useMemo(
    () => (score?.notes ?? []).toSorted((a, b) => a.startBeat - b.startBeat),
    [score?.notes],
  )
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
  }, [isPlaying, notes, score?.pieceId, setCurrentBeat, startRenderTransition])

  useEffect(() => {
    currentBeatRef.current = 0
    nextNoteIndexRef.current = 0
    lastFrameAtRef.current = null
    setCurrentBeat(0)
    stopAll(activeOscillatorsRef.current)
  }, [score?.pieceId, setCurrentBeat])

  useLayoutEffect(() => {
    updateTimelineTransform(timelineRef.current, currentBeatRef.current, renderStartBeat, pixelsPerBeat)
  }, [pixelsPerBeat, renderStartBeat])

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-card shadow-heavy">
      <div ref={noteViewportRef} className="relative min-h-0 flex-1 overflow-hidden">
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
            className="absolute inset-x-0 bottom-0 [contain:paint] will-change-transform"
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
                className={[
                  'absolute rounded-t-[3px]',
                  note.colorClassName,
                ].join(' ')}
                style={initialNoteStyle(note, renderStartBeat, pixelsPerBeat)}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="relative w-full shrink-0 overflow-hidden rounded-b-[4px] bg-[#080808] shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
        style={{
          aspectRatio: `${whitePianoKeys.length} / ${visibleWhiteKeyLengthRatio}`,
        }}
      >
        {whitePianoKeys.map((key) => (
          <div
            key={key.pitch}
            className="absolute inset-y-0 rounded-b-[3px] border-r border-[#aaa] bg-[#f1f1f1] shadow-[inset_0_-12px_20px_rgba(0,0,0,0.18)] first:border-l"
            style={{
              left: `${key.leftPercent}%`,
              width: `${key.widthPercent}%`,
            }}
          />
        ))}
        {blackPianoKeys.map((key) => (
          <div
            key={key.pitch}
            className="absolute top-0 z-10 rounded-b-[3px] bg-[#070707] shadow-[0_7px_12px_rgba(0,0,0,0.7),inset_0_-10px_14px_rgba(255,255,255,0.08)]"
            style={{
              left: `${key.leftPercent}%`,
              width: `${key.widthPercent}%`,
              height: `${blackKeyLengthRatio * 100}%`,
            }}
          />
        ))}
      </div>
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

    const startDelay = Math.max(0, ((note.startBeat - currentBeat) * 60) / bpm)
    const duration = remainingSeconds(note, Math.max(currentBeat, note.startBeat), bpm)
    const startAt = audio.currentTime + startDelay
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = midiToFrequency(note.pitch)
    gain.gain.setValueAtTime(Math.max(0.04, Math.min(0.22, note.velocity / 480)), startAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + duration)
    oscillator.onended = () => activeRef.current.delete(note.id)
    activeRef.current.set(note.id, oscillator)
  }
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

function buildPianoKeyGeometry(): PianoKeyGeometry[] {
  const keys: PianoKeyGeometry[] = []
  const whitePitchToIndex = new Map<number, number>()
  let whiteKeyCount = 0

  for (let pitch = keyboardStartPitch; pitch <= keyboardEndPitch; pitch += 1) {
    if (!isBlackPitch(pitch)) {
      whitePitchToIndex.set(pitch, whiteKeyCount)
      whiteKeyCount += 1
    }
  }

  const whiteWidth = 100 / whiteKeyCount
  const blackWidth = whiteWidth * blackKeyWidthRatio

  for (let pitch = keyboardStartPitch; pitch <= keyboardEndPitch; pitch += 1) {
    const isBlack = isBlackPitch(pitch)
    if (!isBlack) {
      const whiteIndex = whitePitchToIndex.get(pitch) ?? 0
      keys.push({
        pitch,
        isBlack: false,
        leftPercent: whiteIndex * whiteWidth,
        widthPercent: whiteWidth,
      })
      continue
    }

    const previousWhiteIndex = whitePitchToIndex.get(pitch - 1)
    if (previousWhiteIndex === undefined) continue

    keys.push({
      pitch,
      isBlack: true,
      leftPercent: (previousWhiteIndex + 1) * whiteWidth - blackWidth / 2,
      widthPercent: blackWidth,
    })
  }

  return keys
}

function keyGeometryForPitch(pitch: number) {
  if (pitch < keyboardStartPitch || pitch > keyboardEndPitch) return null
  return pianoKeys[pitch - keyboardStartPitch]
}

function isBlackPitch(pitch: number) {
  return blackPitchClasses.has(pitch % 12)
}

function buildMeasureGuides(totalBeats: number, timeSignature: string): MeasureGuide[] {
  return buildMeasureTimings(totalBeats, timeSignature)
}

function buildPitchGuides(pitchClass: number) {
  return pianoKeys.filter((key) => key.pitch % 12 === pitchClass && !key.isBlack)
}
