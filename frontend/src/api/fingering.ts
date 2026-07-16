import { invoke } from '@tauri-apps/api/core'
import type { FingeringPatch } from '../shared/types/domain'

export const fingeringApi = {
  generate(pieceId: string, planId: string, stageId: string) {
    return invoke<FingeringPatch>('music_generate_fingering', {
      pieceId,
      planId,
      stageId,
    })
  },
}
