import { invoke } from '@tauri-apps/api/core'

export type PieceStage = {
  id: string
  startMeasure: number
  endMeasure: number
  label: string
  reason: string
}

export type PieceStagePlan = {
  id: string
  arrangementId: string
  name: string
  segmentationPrompt: string
  model: string
  generation: number
  isActive: boolean
  analyzedAt: string
  stages: PieceStage[]
}

export const pieceStagesApi = {
  get(pieceId: string) {
    return invoke<PieceStagePlan | null>('music_get_stage_plan', { pieceId })
  },
  list(pieceId: string) {
    return invoke<PieceStagePlan[]>('music_list_stage_plans', { pieceId })
  },
  analyze(pieceId: string, planId?: string, name?: string, prompt?: string) {
    return invoke<PieceStagePlan>('music_analyze_stages', {
      pieceId,
      planId,
      name,
      prompt,
    })
  },
  rename(pieceId: string, planId: string, name: string) {
    return invoke<PieceStagePlan>('music_rename_stage_plan', {
      pieceId,
      planId,
      name,
    })
  },
  activate(pieceId: string, planId: string) {
    return invoke<PieceStagePlan>('music_activate_stage_plan', { pieceId, planId })
  },
  delete(pieceId: string, planId: string) {
    return invoke<{ deleted: boolean }>('music_delete_stage_plan', { pieceId, planId })
  },
}
