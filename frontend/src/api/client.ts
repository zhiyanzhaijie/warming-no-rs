import type { AgentSuggestion, Piece, PracticeReport } from '../shared/types/domain'

const pieces: Piece[] = [
  {
    id: 'bach-invention-1',
    title: 'Invention No. 1',
    composer: 'J. S. Bach',
    level: '中级',
    durationSeconds: 96,
    keySignature: 'C Major',
    bpm: 84,
    progress: 0.68,
    lastPracticedAt: '2026-07-07',
    mistakeHotspots: [8, 9, 14, 21],
  },
  {
    id: 'chopin-prelude-7',
    title: 'Prelude Op. 28 No. 7',
    composer: 'F. Chopin',
    level: '初中级',
    durationSeconds: 72,
    keySignature: 'A Major',
    bpm: 62,
    progress: 0.42,
    lastPracticedAt: '2026-07-05',
    mistakeHotspots: [5, 6, 12],
  },
  {
    id: 'czerny-299-4',
    title: 'Etude Op. 299 No. 4',
    composer: 'C. Czerny',
    level: '中级',
    durationSeconds: 118,
    keySignature: 'G Major',
    bpm: 96,
    progress: 0.31,
    lastPracticedAt: '2026-07-02',
    mistakeHotspots: [10, 11, 18, 19, 20],
  },
]

const reports: PracticeReport[] = [
  {
    id: 'r-1',
    pieceTitle: 'Invention No. 1',
    date: '2026-07-07',
    accuracy: 0.91,
    timingScore: 0.84,
    tempo: 72,
    focus: '右手第 8-9 小节十六分音符均匀度',
  },
  {
    id: 'r-2',
    pieceTitle: 'Prelude Op. 28 No. 7',
    date: '2026-07-05',
    accuracy: 0.86,
    timingScore: 0.8,
    tempo: 58,
    focus: '左手和弦提前触键',
  },
]

const suggestions: AgentSuggestion[] = [
  {
    id: 'a-1',
    title: '先拆第 8-9 小节右手',
    detail: '以 60 BPM 循环 4 次，只记录 timing offset，暂时不追求完整速度。',
    evidence: '最近 3 次练习中，第 8-9 小节右手平均提前 42ms。',
  },
  {
    id: 'a-2',
    title: '加入弱拍重音检查',
    detail: '每轮只听第 2、4 拍的力度是否凸出，目标 velocity 波动小于 12。',
    evidence: '第 14 小节出现连续力度峰值，影响声部清晰度。',
  },
]

const wait = (ms = 180) => new Promise((resolve) => window.setTimeout(resolve, ms))

export const apiClient = {
  async listPieces() {
    await wait()
    return pieces
  },
  async getPiece(pieceId: string) {
    await wait()
    return pieces.find((piece) => piece.id === pieceId) ?? pieces[0]
  },
  async listReports() {
    await wait()
    return reports
  },
  async listAgentSuggestions() {
    await wait()
    return suggestions
  },
}
