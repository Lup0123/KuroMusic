import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiPlaylistStore } from '../aiPlaylistStore'
import * as providerAdapter from '../../services/ai/providerAdapter'
import { usePlaylistStore } from '../playlistStore'

vi.mock('../../services/ai/providerAdapter', () => ({
  recommend: vi.fn()
}))

vi.mock('../playlistStore', () => ({
  usePlaylistStore: vi.fn()
}))

describe('aiPlaylistStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('has spec-compliant default state', () => {
    const store = useAiPlaylistStore()

    expect(store.error).toBe('')
    expect(store.floatBall).toEqual({ x: null, y: 120, dock: 'right' })
  })

  it('merges float ball position payload including dock', () => {
    const store = useAiPlaylistStore()

    store.setFloatBallPosition({ x: 88 })
    expect(store.floatBall).toEqual({ x: 88, y: 120, dock: 'right' })

    store.setFloatBallPosition({ dock: 'left' })
    expect(store.floatBall).toEqual({ x: 88, y: 120, dock: 'left' })
  })

  it('generates recommendations and draft from prompt', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'primary', title: '通勤歌单' }],
      draft: {
        name: '通勤歌单',
        reason: '根据提示生成',
        songs: [{ id: 1, name: 'song-1' }]
      }
    })

    const store = useAiPlaylistStore()
    store.setPrompt('通勤想听轻松中文歌')

    const result = await store.generateFromPrompt()

    expect(providerAdapter.recommend).toHaveBeenCalledWith('通勤想听轻松中文歌', { maxSongs: 30 })
    expect(result).toMatchObject({ success: true })
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
    expect(store.recommendations).toHaveLength(1)
    expect(store.draftPlaylist).toMatchObject({ name: '通勤歌单', songs: [{ id: 1, name: 'song-1' }] })
  })

  it('accepts optional prompt arg, trims it, and stores trimmed prompt', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [],
      draft: null
    })

    const store = useAiPlaylistStore()

    await store.generateFromPrompt('  夜跑电子乐  ')

    expect(providerAdapter.recommend).toHaveBeenCalledWith('夜跑电子乐', { maxSongs: 30 })
    expect(store.prompt).toBe('夜跑电子乐')
  })

  it('returns clear error when provider draft has no songs', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [],
      draft: {
        name: '空草稿',
        reason: '无结果',
        songs: []
      }
    })

    const store = useAiPlaylistStore()
    const result = await store.generateFromPrompt('冷门实验电子')

    expect(result).toMatchObject({
      success: false,
      error: '未找到可用歌曲，请尝试更具体或不同风格的提示词'
    })
    expect(store.error).toBe('未找到可用歌曲，请尝试更具体或不同风格的提示词')
    expect(store.recommendations).toEqual([])
    expect(store.draftPlaylist).toMatchObject({ songs: [] })
  })

  it('returns reason "empty" when draft is empty', async () => {
    const store = useAiPlaylistStore()

    const result = await store.createDraftToLocalPlaylist()

    expect(result).toEqual({ success: false, reason: 'empty' })
  })

  it('returns reason "create_failed" when local playlist creation fails', async () => {
    const playlistStoreMock = {
      createLocalPlaylist: vi.fn().mockResolvedValue({}),
      addSongToLocalPlaylist: vi.fn()
    }
    usePlaylistStore.mockReturnValue(playlistStoreMock)

    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: 'AI通勤歌单',
      reason: '根据你的提示生成',
      songs: [{ id: 11, name: 'song-11' }]
    }

    const result = await store.createDraftToLocalPlaylist()

    expect(result).toEqual({ success: false, reason: 'create_failed' })
  })

  it('creates local playlist from draft and adds songs in sequence', async () => {
    const playlistStoreMock = {
      createLocalPlaylist: vi.fn().mockResolvedValue({ id: 'local-1', name: 'AI推荐歌单' }),
      addSongToLocalPlaylist: vi.fn().mockResolvedValue(true)
    }
    usePlaylistStore.mockReturnValue(playlistStoreMock)

    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: 'AI通勤歌单',
      reason: '根据你的提示生成',
      songs: [
        { id: 11, name: 'song-11' },
        { id: 22, name: 'song-22' }
      ]
    }

    const result = await store.createDraftToLocalPlaylist()

    expect(playlistStoreMock.createLocalPlaylist).toHaveBeenCalledWith({
      name: 'AI通勤歌单',
      description: '根据你的提示生成',
      songs: []
    })
    expect(playlistStoreMock.addSongToLocalPlaylist).toHaveBeenNthCalledWith(1, 'local-1', {
      id: 11,
      name: 'song-11'
    })
    expect(playlistStoreMock.addSongToLocalPlaylist).toHaveBeenNthCalledWith(2, 'local-1', {
      id: 22,
      name: 'song-22'
    })
    expect(result).toMatchObject({
      success: true,
      playlistId: 'local-1',
      totalSongs: 2,
      addedSongs: 2,
      failedSongs: []
    })
    expect(store.creating).toBe(false)
    expect(store.error).toBe('')
  })
})
