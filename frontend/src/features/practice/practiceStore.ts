import { create } from 'zustand'
import type { PracticeMode } from '../../shared/types/domain'

type PracticeState = {
  bpm: number
  isPlaying: boolean
  loopEnabled: boolean
  loopRange: [number, number]
  mode: PracticeMode
  connectedDevice: string
  setBpm: (bpm: number) => void
  setMode: (mode: PracticeMode) => void
  togglePlayback: () => void
  toggleLoop: () => void
  setLoopRange: (range: [number, number]) => void
}

export const usePracticeStore = create<PracticeState>((set) => ({
  bpm: 72,
  isPlaying: false,
  loopEnabled: true,
  loopRange: [8, 12],
  mode: 'both-hands',
  connectedDevice: 'Local MIDI Device',
  setBpm: (bpm) => set({ bpm }),
  setMode: (mode) => set({ mode }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  setLoopRange: (loopRange) => set({ loopRange }),
}))
