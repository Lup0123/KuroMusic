import { describe, expect, it, vi } from 'vitest'
import { recommendPlaylistByLLM } from '../llmPlaylist'

describe('recommendPlaylistByLLM', () => {
  it('passes chat history into llm client payload', async () => {
    const llmClient = vi.fn(async () =>
      JSON.stringify({ intent: '夜跑动感', reason: '根据历史偏好调整' })
    )
    const searchSongs = vi.fn(async () => [
      {
        id: 101,
        name: 'Run Song',
        artists: [{ name: 'Artist A' }],
        album: 'Album A',
        albumCover: '',
        durationMs: 180000,
        duration: '03:00'
      }
    ])

    await recommendPlaylistByLLM({
      prompt: '再快一点',
      context: {
        messages: [
          { role: 'user', content: '我想听夜跑歌单' },
          { role: 'assistant', content: '好的，给你动感风格' }
        ]
      },
      llmClient,
      searchSongs
    })

    expect(llmClient).toHaveBeenCalledWith({
      prompt: '再快一点',
      messages: [
        { role: 'user', content: '我想听夜跑歌单' },
        { role: 'assistant', content: '好的，给你动感风格' }
      ]
    })
  })

  it('merges base songs when prompt is adjustment-like', async () => {
    const llmClient = vi.fn(async () => JSON.stringify({ intent: '增加电子', reason: '增强节奏' }))
    const searchSongs = vi.fn(async () => [
      {
        id: 2,
        name: 'New Song',
        artists: [{ name: 'Artist B' }],
        album: 'Album B',
        albumCover: '',
        durationMs: 200000,
        duration: '03:20'
      }
    ])

    const result = await recommendPlaylistByLLM({
      prompt: '再加一点电子',
      context: {
        baseSongs: [
          {
            id: 1,
            name: 'Base Song',
            artist: 'Artist A',
            album: 'Base Album',
            albumCover: '',
            durationMs: 190000,
            duration: '03:10'
          }
        ]
      },
      llmClient,
      searchSongs
    })

    expect(result.draft.songs.map((song) => song.id)).toEqual([1, 2])
  })

  it('merges semantic tags into keywords within budget, explicit artist first', async () => {
    const llmClient = vi.fn(async () => JSON.stringify({ intent: '夜跑', artist: '周杰伦' }))
    const searchSongs = vi.fn(async () => [])
    const semanticExpander = vi.fn(async () => ['动感', '跑步', '燃'])

    const result = await recommendPlaylistByLLM({
      prompt: '夜跑动感一点',
      context: {},
      llmClient,
      searchSongs,
      semanticExpander
    })

    expect(semanticExpander).toHaveBeenCalled()
    expect(result.debug.keywords[0]).toBe('周杰伦')
    expect(result.debug.keywords).toContain('动感')
    expect(result.debug.semanticTags).toEqual(['动感', '跑步', '燃'])
    expect(result.debug.keywords.length).toBeLessThanOrEqual(6)
  })

  it('tolerates semantic expander failures', async () => {
    const llmClient = vi.fn(async () => JSON.stringify({ intent: '夜跑' }))
    const searchSongs = vi.fn(async () => [])
    const semanticExpander = vi.fn(async () => {
      throw new Error('boom')
    })

    const result = await recommendPlaylistByLLM({
      prompt: '夜跑',
      context: {},
      llmClient,
      searchSongs,
      semanticExpander
    })

    expect(result.debug.semanticTags).toEqual([])
    expect(result.debug.keywords.length).toBeGreaterThan(0)
  })

  it('filters out excluded song ids from candidates', async () => {
    const llmClient = vi.fn(async () => JSON.stringify({ intent: '夜跑' }))
    const searchSongs = vi.fn(async () => [
      {
        id: 101,
        name: 'Run A',
        artists: [{ name: 'Artist X' }],
        album: 'Album A',
        albumCover: '',
        durationMs: 180000,
        duration: '03:00'
      },
      {
        id: 102,
        name: 'Run B',
        artists: [{ name: 'Artist Y' }],
        album: 'Album B',
        albumCover: '',
        durationMs: 200000,
        duration: '03:20'
      }
    ])

    const result = await recommendPlaylistByLLM({
      prompt: '夜跑',
      context: { excludeSongIds: ['101'] },
      llmClient,
      searchSongs
    })

    const ids = result.draft.songs.map((song) => song.id)
    expect(ids).not.toContain(101)
    expect(ids).toContain(102)
  })
})
