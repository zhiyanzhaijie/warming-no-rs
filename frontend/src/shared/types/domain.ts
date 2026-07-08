export type PracticeMode = 'listen' | 'right-hand' | 'left-hand' | 'both-hands'

export type Piece = {
  id: string
  title: string
  composer: string
  level: string
  durationSeconds: number
  keySignature: string
  bpm: number
  progress: number
  lastPracticedAt: string
  mistakeHotspots: number[]
  sourcePath?: string | null
  arrangementCount?: number
  noteCount?: number
}

export type MidiScanReport = {
  watchedPaths: string[]
  discoveredFiles: number
  registeredFiles: number
}

export type PracticeReport = {
  id: string
  pieceTitle: string
  date: string
  accuracy: number
  timingScore: number
  tempo: number
  focus: string
}

export type AgentSuggestion = {
  id: string
  title: string
  detail: string
  evidence: string
}
