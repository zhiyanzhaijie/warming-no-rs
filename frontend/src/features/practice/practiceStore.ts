import { create } from 'zustand'
import type { PracticeMode } from '../../shared/types/domain'

type PracticeState = {
  bpm: number
  currentBeat: number
  seekRequest: { pieceId: string; beat: number; id: number } | null
  isPlaying: boolean
  loopEnabled: boolean
  loopRange: LoopRange | null
  loopSelecting: boolean
  loopSelectionAnchor: LoopMeasure | null
  mode: PracticeMode
  connectedDevice: string
  setBpm: (bpm: number) => void
  setCurrentBeat: (currentBeat: number) => void
  requestSeek: (pieceId: string, beat: number) => void
  setMode: (mode: PracticeMode) => void
  togglePlayback: () => void
  toggleLoop: () => void
  beginLoopSelection: () => void
  selectLoopMeasure: (measure: LoopMeasure) => void
  clearLoop: () => void
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
  bpm: 72,
  currentBeat: 0,
  seekRequest: null,
  isPlaying: false,
  loopEnabled: false,
  loopRange: null,
  loopSelecting: false,
  loopSelectionAnchor: null,
  mode: 'listen',
  connectedDevice: '本地 MIDI 设备',
  setBpm: (bpm) => set({ bpm }),
  setCurrentBeat: (currentBeat) => set({ currentBeat }),
  requestSeek: (pieceId, beat) =>
    set((state) => ({
      seekRequest: { pieceId, beat, id: (state.seekRequest?.id ?? 0) + 1 },
    })),
  setMode: (mode) => set({ mode, isPlaying: false }),
  togglePlayback: () =>
    set((state) =>
      state.mode !== 'free' ? { isPlaying: !state.isPlaying } : state,
    ),
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
