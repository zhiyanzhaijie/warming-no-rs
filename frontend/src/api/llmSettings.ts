import { invoke } from '@tauri-apps/api/core'

export type LlmSettings = {
  baseUrl: string
  model: string
  updatedAt: string
  apiKeyConfigured: boolean
}

export type LlmConnectionResult = {
  connected: boolean
  model: string
  latencyMs: number
}

export type LlmSettingsInput = {
  baseUrl: string
  model: string
  apiKey: string
}

export const llmSettingsApi = {
  get() {
    return invoke<LlmSettings>('llm_get_settings')
  },
  save(input: LlmSettingsInput) {
    return invoke<LlmSettings>('llm_save_settings', input)
  },
  clearApiKey() {
    return invoke<{ apiKeyConfigured: boolean }>('llm_clear_api_key')
  },
  testConnection(input: LlmSettingsInput) {
    return invoke<LlmConnectionResult>('llm_test_connection', input)
  },
}
