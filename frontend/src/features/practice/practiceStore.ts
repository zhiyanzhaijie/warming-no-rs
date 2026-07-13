import { create } from 'zustand'
import type { PracticeMode } from '../../shared/types/domain'

type PracticeState = {
  session: PracticeSession | null
  bpm: number
  currentBeat: number
  seekRequest: { pieceId: string; beat: number; id: number } | null
  isPlaying: boolean
  loopEnabled: boolean
  loopRange: LoopRange | null
  loopSelecting: boolean
  loopSelectionAnchor: LoopMeasure | null
  mode: PracticeMode
  startSession: (piece: { id: string; title: string }) => void
  endSession: () => void
  setBpm: (bpm: number) => void
  setCurrentBeat: (currentBeat: number) => void
  requestSeek: (pieceId: string, beat: number) => void
  setMode: (mode: PracticeMode) => void
  togglePlayback: () => void
  pausePlayback: () => void
  toggleLoop: () => void
  beginLoopSelection: () => void
  selectLoopMeasure: (measure: LoopMeasure) => void
  clearLoop: () => void
}

export type PracticeSession = {
  pieceId: string
  pieceTitle: string
  currentBeat: number
}

export type LoopMeasure = {
  number: number
  startBeat: number
  endBeat: number
}

export type LoopRange = {
  startBeat: number
  endBeat: number
  startMeasure: number
  endMeasure: number
}

export const usePracticeStore = create<PracticeState>((set) => ({
  session: null,
  bpm: 72,
  currentBeat: 0,
  seekRequest: null,
  isPlaying: false,
  loopEnabled: false,
  loopRange: null,
  loopSelecting: false,
  loopSelectionAnchor: null,
  mode: 'listen',
  startSession: (piece) =>
    set((state) => state.session?.pieceId === piece.id
      ? { session: { ...state.session, pieceTitle: piece.title }, isPlaying: false }
      : {
          session: { pieceId: piece.id, pieceTitle: piece.title, currentBeat: 0 },
          currentBeat: 0,
          isPlaying: false,
          loopEnabled: false,
          loopRange: null,
          loopSelecting: false,
          loopSelectionAnchor: null,
        }),
  endSession: () => set({
    session: null,
    currentBeat: 0,
    seekRequest: null,
    isPlaying: false,
    loopEnabled: false,
    loopRange: null,
    loopSelecting: false,
    loopSelectionAnchor: null,
  }),
  setBpm: (bpm) => set({ bpm }),
  setCurrentBeat: (currentBeat) => set((state) => ({
    currentBeat,
    session: state.session ? { ...state.session, currentBeat } : null,
  })),
  requestSeek: (pieceId, beat) =>
    set((state) => ({
      seekRequest: { pieceId, beat, id: (state.seekRequest?.id ?? 0) + 1 },
    })),
  setMode: (mode) => set({ mode, isPlaying: false }),
  togglePlayback: () =>
    set((state) =>
      state.mode !== 'free' ? { isPlaying: !state.isPlaying } : state,
    ),
  pausePlayback: () => set({ isPlaying: false }),
  toggleLoop: () =>
    set((state) =>
      state.loopRange
        ? { loopEnabled: !state.loopEnabled, loopSelecting: false, loopSelectionAnchor: null }
        : { loopEnabled: false, loopSelecting: true, loopSelectionAnchor: null },
    ),
  beginLoopSelection: () => set({ loopEnabled: false, loopRange: null, loopSelecting: true, loopSelectionAnchor: null }),
  selectLoopMeasure: (measure) =>
    set((state) => {
      const anchor = state.loopSelectionAnchor
      if (!state.loopSelecting) return {}
      if (!anchor) return { loopSelectionAnchor: measure }
      return {
        loopSelectionAnchor: null,
        loopSelecting: false,
        loopEnabled: true,
        loopRange: {
          startBeat: Math.min(anchor.startBeat, measure.startBeat),
          endBeat: Math.max(anchor.endBeat, measure.endBeat),
          startMeasure: Math.min(anchor.number, measure.number),
          endMeasure: Math.max(anchor.number, measure.number),
        },
      }
    }),
  clearLoop: () => set({ loopEnabled: false, loopRange: null, loopSelecting: false, loopSelectionAnchor: null }),
}))
