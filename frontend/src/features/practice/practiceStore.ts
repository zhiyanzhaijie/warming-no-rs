import { create } from 'zustand'
import type { PracticeMode } from '../../shared/types/domain'

type PracticeState = {
  bpm: number
  currentBeat: number
  seekRequest: { pieceId: string; beat: number; id: number } | null
  isPlaying: boolean
  loopEnabled: boolean
  loopRange: [number, number]
  mode: PracticeMode
  connectedDevice: string
  setBpm: (bpm: number) => void
  setCurrentBeat: (currentBeat: number) => void
  requestSeek: (pieceId: string, beat: number) => void
  setMode: (mode: PracticeMode) => void
  togglePlayback: () => void
  toggleLoop: () => void
  setLoopRange: (range: [number, number]) => void
}

export const usePracticeStore = create<PracticeState>((set) => ({
  bpm: 72,
  currentBeat: 0,
  seekRequest: null,
  isPlaying: false,
  loopEnabled: true,
  loopRange: [8, 12],
  mode: 'both-hands',
  connectedDevice: 'Local MIDI Device',
  setBpm: (bpm) => set({ bpm }),
  setCurrentBeat: (currentBeat) => set({ currentBeat }),
  requestSeek: (pieceId, beat) =>
    set((state) => ({
      seekRequest: { pieceId, beat, id: (state.seekRequest?.id ?? 0) + 1 },
    })),
  setMode: (mode) => set({ mode }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  setLoopRange: (loopRange) => set({ loopRange }),
}))
