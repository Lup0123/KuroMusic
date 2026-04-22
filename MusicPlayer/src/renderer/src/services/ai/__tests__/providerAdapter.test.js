import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recommend } from '../providerAdapter'

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
    expect(window.api.aiRecommendPlaylist).toHaveBeenCalledWith(
      '夜跑电子',
      expect.objectContaining({ timeoutMs: 35000 })
    )
    expect(result.draft.name).toBe('LLM歌单')
  })

  it('always uses llm provider even when providerMode is rule', async () => {
    const result = await recommend('通勤', { useLLM: true, providerMode: 'rule' })

    expect(window.api.aiRecommendPlaylist).toHaveBeenCalledOnce()
    expect(result.draft.name).toBe('LLM歌单')
  })

  it('returns timeout fallback result when llm request times out', async () => {
    window.api.aiRecommendPlaylist.mockImplementationOnce(() => new Promise(() => {}))

    const result = await recommend('深夜电子', {
      useLLM: true,
      timeoutMs: 20,
      baseSongs: [{ id: 99, name: 'base-song', artist: 'artist-1' }]
    })

    expect(result.debug.fallback).toBe('timeout_guard')
    expect(result.debug.llmErrorType).toBe('timeout')
    expect(result.draft.songs).toHaveLength(1)
  })

  it('throws on non-timeout llm errors', async () => {
    window.api.aiRecommendPlaylist.mockRejectedValueOnce(new Error('llm error'))

    await expect(recommend('通勤', { useLLM: true })).rejects.toThrow('llm error')
  })

  it('throws when llm api bridge is unavailable', async () => {
    globalThis.window = { api: {} }

    await expect(recommend('通勤', { useLLM: true })).rejects.toThrow('LLM provider is unavailable')
  })
})
