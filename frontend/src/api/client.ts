import { invoke } from '@tauri-apps/api/core'
import type {
  AgentSuggestion,
  MidiScanReport,
  Piece,
  PieceScore,
  PracticeReport,
} from '../shared/types/domain'

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
  listPieces() {
    return invoke<Piece[]>('music_list_pieces')
  },
  getPiece(pieceId: string) {
    return invoke<Piece>('music_get_piece', { pieceId })
  },
  getPieceScore(pieceId: string) {
    return invoke<PieceScore>('music_get_piece_score', { pieceId })
  },
  deletePiece(pieceId: string) {
    return invoke<{ deleted: boolean }>('music_delete_piece', { pieceId })
  },
  listWatchPaths() {
    return invoke<{ paths: string[] }>('music_list_watch_paths')
  },
  selectWatchDirectories() {
    return invoke<string[]>('select_midi_watch_directories')
  },
  addWatchPath(path: string) {
    return invoke<MidiScanReport>('music_add_watch_path', { path })
  },
  addWatchPaths(paths: string[]) {
    return invoke<MidiScanReport>('music_add_watch_paths', { paths })
  },
  refreshLocalLibrary() {
    return invoke<MidiScanReport>('music_refresh_library')
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
