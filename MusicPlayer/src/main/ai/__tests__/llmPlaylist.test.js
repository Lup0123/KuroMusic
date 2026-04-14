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
})
