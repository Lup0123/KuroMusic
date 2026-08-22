import { afterEach, describe, expect, it, vi } from 'vitest'
import { rerankCandidates } from '../langchainRecommend'

const BASE_SONGS = [
  { id: '1', name: 'Song A', artist: 'Artist X' },
  { id: '2', name: 'Song B', artist: 'Artist Y' },
  { id: '3', name: 'Song C', artist: 'Artist Z' }
]

function stubFetchWithContent(content) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] })
    }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rerankCandidates', () => {
  it('parses order and highlights, filtering unknown ids', async () => {
    stubFetchWithContent(
      JSON.stringify({
        order: ['2', '1', '3', '999'],
        highlights: [
          { id: '2', reason: '节奏感强' },
          { id: '999', reason: '不应出现' }
        ]
      })
    )

    const result = await rerankCandidates({
      songs: BASE_SONGS,
      apiKey: 'test-key'
    })

    expect(result.order).toEqual(['2', '1', '3'])
    expect(result.highlights).toEqual([{ id: '2', reason: '节奏感强' }])
  })

  it('parses JSON inside markdown fences', async () => {
    stubFetchWithContent(
      '```json\n{"order": ["3", "2", "1"], "highlights": [{"id": "3", "reason": "最合适"}]}\n```'
    )

    const result = await rerankCandidates({
      songs: BASE_SONGS,
      apiKey: 'test-key'
    })

    expect(result.order).toEqual(['3', '2', '1'])
    expect(result.highlights).toEqual([{ id: '3', reason: '最合适' }])
  })

  it('throws when output cannot be parsed', async () => {
    stubFetchWithContent('抱歉，我无法返回 JSON。')

    await expect(
      rerankCandidates({ songs: BASE_SONGS, apiKey: 'test-key' })
    ).rejects.toThrow(/解析失败/)
  })
})
