import { apiClient } from './client'

export const scoreApi = {
  listPieces: apiClient.listPieces,
  getPiece: apiClient.getPiece,
  listWatchPaths: apiClient.listWatchPaths,
  addWatchPath: apiClient.addWatchPath,
  refreshLocalLibrary: apiClient.refreshLocalLibrary,
}
