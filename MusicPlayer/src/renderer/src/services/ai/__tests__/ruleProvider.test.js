import { describe, expect, it, vi } from 'vitest'
import {
  buildDraftFromSongs,
  parsePromptToSignals,
  recommendByRule
} from '../ruleProvider'
import { assertProviderResultShape } from '../providerAdapter'

describe('ruleProvider', () => {
  it('validates provider result schema in adapter helper', () => {
    expect(() =>
      assertProviderResultShape({ recommendations: [], draft: { name: 'n', reason: 'r', songs: [] } })
    ).not.toThrow()

    expect(() => assertProviderResultShape(null)).toThrow('AI provider returned empty result')
    expect(() => assertProviderResultShape({ recommendations: 'bad', draft: { songs: [] } })).toThrow(
      'AI provider result.recommendations must be an array'
    )
    expect(() => assertProviderResultShape({ recommendations: [], draft: null })).toThrow(
      'AI provider result.draft must be an object'
    )
    expect(() => assertProviderResultShape({ recommendations: [], draft: {} })).toThrow(
      'AI provider result.draft.songs must be an array'
    )
  })

  it('extracts mood and scene signals from Chinese prompt', () => {
    const signals = parsePromptToSignals('通勤时想听一些轻松的中文歌')
    expect(signals.moods).toContain('轻松')
    expect(signals.scenes).toContain('通勤')
    expect(signals.languages).toContain('华语')
  })

  it('builds deterministic draft with deduped songs', () => {
    const songs = [
      { id: 1, name: 'A', artist: 'X', album: 'AA', albumCover: '', duration: '03:10', durationMs: 190000 },
      { id: 1, name: 'A', artist: 'X', album: 'AA', albumCover: '', duration: '03:10', durationMs: 190000 },
      { id: 2, name: 'B', artist: 'Y', album: 'BB', albumCover: '', duration: '03:20', durationMs: 200000 }
    ]

    const draft = buildDraftFromSongs('通勤歌单', songs)
    expect(draft.name).toContain('通勤')
    expect(draft.songs).toHaveLength(2)
    expect(draft.songs.map((song) => song.id)).toEqual([1, 2])
  })

  it('returns stable shape and deduped/capped songs from search results', async () => {
    const searchMock = vi
      .fn()
      .mockResolvedValueOnce({
        body: {
          result: {
            songs: [
              {
                id: 1,
                name: '轻松通勤曲',
                ar: [{ name: 'Artist A' }],
                al: { name: 'Album A', picUrl: '' },
                dt: 190000
              },
              {
                id: 1,
                name: '轻松通勤曲',
                ar: [{ name: 'Artist A' }],
                al: { name: 'Album A', picUrl: '' },
                dt: 190000
              }
            ]
          }
        }
      })
      .mockResolvedValue({ body: { result: { songs: [] } } })

    vi.stubGlobal('window', { api: { search: searchMock } })

    const result = await recommendByRule('通勤轻松中文', { maxSongs: 1 })

    expect(Array.isArray(result.recommendations)).toBe(true)
    expect(result.draft).toMatchObject({ name: expect.any(String), reason: expect.any(String), songs: expect.any(Array) })
    expect(result.debug).toMatchObject({ provider: 'rule', keywords: expect.any(Array) })
    expect(result.draft.songs).toHaveLength(1)
    expect(result.draft.songs[0].id).toBe(1)
    expect(searchMock).toHaveBeenCalled()
  })

  it('handles empty prompt gracefully when search api unavailable', async () => {
    vi.stubGlobal('window', { api: {} })
    const result = await recommendByRule('', {})

    expect(result.recommendations).toEqual([])
    expect(result.draft).toMatchObject({ name: expect.any(String), songs: [] })
    expect(result.debug.provider).toBe('rule')
  })

  it('keeps degraded behavior when one keyword search rejects', async () => {
    const searchMock = vi.fn((keyword) => {
      if (String(keyword).includes('通勤轻松中文')) {
        return Promise.reject(new Error('network down'))
      }
      if (keyword === '轻松') {
        return Promise.resolve({
          body: {
            result: {
              songs: [
                {
                  id: 7,
                  name: '轻松加班曲',
                  ar: [{ name: 'Artist B' }],
                  al: { name: 'Album B', picUrl: '' },
                  dt: 210000
                }
              ]
            }
          }
        })
      }
      return Promise.resolve({ body: { result: { songs: [] } } })
    })

    vi.stubGlobal('window', { api: { search: searchMock } })

    const result = await recommendByRule('通勤轻松中文', { maxSongs: 5 })

    expect(result.recommendations).toHaveLength(1)
    expect(result.draft.songs[0].id).toBe(7)
    expect(searchMock).toHaveBeenCalledWith('轻松', 1, 30, 0)
  })

  it('sanitizes and limits raw prompt keyword', async () => {
    const searchMock = vi.fn().mockResolvedValue({ body: { result: { songs: [] } } })
    vi.stubGlobal('window', { api: { search: searchMock } })

    const result = await recommendByRule('  <<drop table>> 超超超超超超超超超超超超超超超超超超超超  ', {})

    expect(result.debug.keywords[0].startsWith('drop table')).toBe(true)
    expect(result.debug.keywords[0].length).toBeLessThanOrEqual(24)
  })

  it('caps generated songs by default max of 30', async () => {
    const songs = Array.from({ length: 40 }).map((_, index) => ({
      id: index + 1,
      name: `song-${index + 1}`,
      ar: [{ name: 'Artist' }],
      al: { name: 'Album', picUrl: '' },
      dt: 200000
    }))
    const searchMock = vi.fn().mockResolvedValueOnce({ body: { result: { songs } } }).mockResolvedValue({
      body: { result: { songs: [] } }
    })
    vi.stubGlobal('window', { api: { search: searchMock } })

    const result = await recommendByRule('通勤轻松中文', { maxSongs: 999 })

    expect(result.draft.songs).toHaveLength(30)
  })

  it('broadens query once when initial songs are below safe minimum', async () => {
    const searchMock = vi.fn((keyword) => {
      if (keyword === '通勤轻松中文') {
        return Promise.resolve({
          body: {
            result: {
              songs: [
                {
                  id: 1,
                  name: '轻松通勤曲',
                  ar: [{ name: 'Artist A' }],
                  al: { name: 'Album A', picUrl: '' },
                  dt: 190000
                }
              ]
            }
          }
        })
      }
      if (keyword === '热门') {
        return Promise.resolve({
          body: {
            result: {
              songs: [
                { id: 2, name: '热门2', ar: [{ name: 'A' }], al: { name: 'B', picUrl: '' }, dt: 200000 },
                { id: 3, name: '热门3', ar: [{ name: 'A' }], al: { name: 'B', picUrl: '' }, dt: 200000 },
                { id: 4, name: '热门4', ar: [{ name: 'A' }], al: { name: 'B', picUrl: '' }, dt: 200000 },
                { id: 5, name: '热门5', ar: [{ name: 'A' }], al: { name: 'B', picUrl: '' }, dt: 200000 }
              ]
            }
          }
        })
      }
      return Promise.resolve({ body: { result: { songs: [] } } })
    })

    vi.stubGlobal('window', { api: { search: searchMock } })

    const result = await recommendByRule('通勤轻松中文', { maxSongs: 30 })
    const hotCalls = searchMock.mock.calls.filter(([keyword]) => keyword === '热门')

    expect(result.draft.songs.length).toBeGreaterThanOrEqual(5)
    expect(hotCalls).toHaveLength(1)
  })
})
