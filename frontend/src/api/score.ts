import { apiClient } from './client'

export const scoreApi = {
  listPieces: apiClient.listPieces,
  getPiece: apiClient.getPiece,
  getPieceScore: apiClient.getPieceScore,
  deletePiece: apiClient.deletePiece,
  listWatchPaths: apiClient.listWatchPaths,
  selectWatchDirectories: apiClient.selectWatchDirectories,
  addWatchPath: apiClient.addWatchPath,
  addWatchPaths: apiClient.addWatchPaths,
  refreshLocalLibrary: apiClient.refreshLocalLibrary,
}
