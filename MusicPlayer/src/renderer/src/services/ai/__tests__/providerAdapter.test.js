import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recommend } from '../providerAdapter'

vi.mock('../ruleProvider', () => ({
  recommendByRule: vi.fn(async () => ({
    recommendations: [{ id: 'rule', title: '规则推荐' }],
    draft: { name: '规则歌单', reason: 'rule', songs: [{ id: 1, name: 'song-1' }] },
    debug: { provider: 'rule' }
  }))
}))

describe('providerAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.window = {
      api: {
        aiRecommendPlaylist: vi.fn(async () => ({
          recommendations: [{ id: 'llm', title: 'LLM推荐' }],
          draft: { name: 'LLM歌单', reason: 'llm', songs: [{ id: 2, name: 'song-2' }] },
          debug: { provider: 'llm' }
        }))
      }
    }
  })

  it('uses llm provider when useLLM is true', async () => {
    const result = await recommend('夜跑电子', { useLLM: true })
    expect(window.api.aiRecommendPlaylist).toHaveBeenCalledWith('夜跑电子', { useLLM: true })
    expect(result.draft.name).toBe('LLM歌单')
  })

  it('forces rule provider when providerMode is rule', async () => {
    const result = await recommend('通勤', { useLLM: true, providerMode: 'rule' })

    expect(window.api.aiRecommendPlaylist).not.toHaveBeenCalled()
    expect(result.draft.name).toBe('规则歌单')
  })

  it('falls back to rule provider when llm provider fails', async () => {
    window.api.aiRecommendPlaylist.mockRejectedValueOnce(new Error('llm error'))

    const result = await recommend('通勤', { useLLM: true })

    expect(result.draft.name).toBe('规则歌单')
    expect(result.debug.fallback).toBe('rule')
    expect(result.debug.llmErrorType).toBe('unknown')
  })

  it('falls back with timeout classification when llm request times out', async () => {
    window.api.aiRecommendPlaylist.mockImplementationOnce(() => new Promise(() => {}))

    const result = await recommend('深夜电子', { useLLM: true, timeoutMs: 20 })

    expect(result.debug.fallback).toBe('rule')
    expect(result.debug.llmErrorType).toBe('timeout')
  })

  it('classifies auth errors from llm and falls back', async () => {
    const authError = new Error('401 Unauthorized')
    authError.status = 401
    window.api.aiRecommendPlaylist.mockRejectedValueOnce(authError)

    const result = await recommend('通勤', { useLLM: true })

    expect(result.debug.fallback).toBe('rule')
    expect(result.debug.llmErrorType).toBe('auth')
  })
})
