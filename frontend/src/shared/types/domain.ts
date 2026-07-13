export type PracticeMode = 'listen' | 'free' | 'right-hand' | 'left-hand' | 'both-hands'

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
  updatedFiles: number
}

export type ScoreNote = {
  id: string
  pitch: number
  startBeat: number
  durationBeats: number
  velocity: number
  track: number
  channel: number
  hand: 'left' | 'right' | 'unknown'
  handConfidence: number
}

export type PieceScore = {
  pieceId: string
  title: string
  tempoBpm: number
  timeSignature: string
  totalBeats: number
  notes: ScoreNote[]
  handAnalysisVersion: string | null
  handConfidence: number
}

export type AgentSuggestion = {
  id: string
  title: string
  detail: string
  evidence: string
}
