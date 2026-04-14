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
  const createMemoryStorage = () => {
    let store = {}
    return {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value)
      },
      removeItem: (key) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      }
    }
  }

  function createDeferred() {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    globalThis.localStorage = createMemoryStorage()
    localStorage.clear()
  })

  it('has spec-compliant default state', () => {
    const store = useAiPlaylistStore()

    expect(store.error).toBe('')
    expect(store.floatBall).toEqual({ x: null, y: 120, dock: 'right' })
    expect(store.lastCreateResult).toBe(null)
    expect(store.pendingDraftPlaylist).toBe(null)
    expect(store.lastAdjustmentMeta).toBe(null)
    expect(store.pendingDraftDiff).toEqual({ addedSongs: [], removedSongs: [] })
    expect(store.pendingDraftSelection).toEqual({ addedSongIds: [], removedSongIds: [] })
    expect(store.pendingApplyMode).toBe('standard')
    expect(store.providerMode).toBe('auto')
    expect(store.sessions).toHaveLength(1)
    expect(store.currentSessionId).toBe(store.sessions[0].id)
  })

  it('persists and restores ai store snapshot from localStorage', () => {
    const snapshot = {
      providerMode: 'rule',
      recentPrompts: ['通勤', '夜跑'],
      generationMetrics: [{ prompt: '通勤', provider: 'rule', success: true, time: Date.now() }],
      sessions: [
        {
          id: 'session-persist-1',
          title: '持久化会话',
          prompt: '测试提示词',
          recommendations: [{ id: 'rec-1', title: '推荐' }],
          chatMessages: [{ id: 'm1', role: 'user', content: 'hello', time: Date.now() }],
          draftPlaylist: { name: '草稿', reason: 'test', songs: [{ id: 1, name: 'song-1' }] },
          pendingDraftPlaylist: null,
          lastCommittedDraft: null,
          lastAdjustmentMeta: null,
          pendingDraftDiff: { addedSongs: [], removedSongs: [] },
          pendingDraftSelection: { addedSongIds: [], removedSongIds: [] },
          pendingApplyMode: 'standard',
          lastCreateResult: null
        }
      ],
      currentSessionId: 'session-persist-1'
    }

    localStorage.setItem('aiPlaylistStoreState', JSON.stringify(snapshot))

    const store = useAiPlaylistStore()
    store.restoreStoreState()

    expect(store.providerMode).toBe('rule')
    expect(store.recentPrompts).toEqual(['通勤', '夜跑'])
    expect(store.currentSessionId).toBe('session-persist-1')
    expect(store.prompt).toBe('测试提示词')
    expect(store.draftPlaylist).toMatchObject({ name: '草稿' })
  })

  it('writes store snapshot to localStorage when state changes', () => {
    const store = useAiPlaylistStore()

    store.setProviderMode('llm')
    store.setPrompt('写入测试')
    store.persistStoreState()

    const raw = localStorage.getItem('aiPlaylistStoreState')
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw)
    expect(parsed.providerMode).toBe('llm')
    expect(parsed.currentSessionId).toBe(store.currentSessionId)
    expect(parsed.sessions).toHaveLength(store.sessions.length)
  })

  it('merges float ball position payload including dock', () => {
    const store = useAiPlaylistStore()

    store.setFloatBallPosition({ x: 88 })
    expect(store.floatBall).toEqual({ x: 88, y: 120, dock: 'right' })

    store.setFloatBallPosition({ dock: 'left' })
    expect(store.floatBall).toEqual({ x: 88, y: 120, dock: 'left' })
  })

  it('normalizes chat message structure with standard fields', () => {
    const store = useAiPlaylistStore()

    store.addChatMessage('assistant', '已生成歌单', {
      provider: 'llm',
      type: 'status',
      intent: '增强动感'
    })

    expect(store.chatMessages).toHaveLength(1)
    expect(store.chatMessages[0]).toMatchObject({
      role: 'assistant',
      content: '已生成歌单',
      provider: 'llm',
      type: 'status',
      error: false,
      meta: {
        intent: '增强动感'
      }
    })
    expect(typeof store.chatMessages[0].time).toBe('number')
    expect(typeof store.chatMessages[0].id).toBe('string')
  })

  it('supports switching provider mode', () => {
    const store = useAiPlaylistStore()

    store.setProviderMode('rule')
    expect(store.providerMode).toBe('rule')

    store.setProviderMode('llm')
    expect(store.providerMode).toBe('llm')

    store.setProviderMode('invalid')
    expect(store.providerMode).toBe('auto')
  })

  it('tracks recent prompts in most-recent order without duplicates', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'ok', title: '推荐' }],
      draft: { name: '歌单', reason: 'ok', songs: [{ id: 1, name: 'song-1' }] },
      debug: { provider: 'llm' }
    })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('通勤')
    await store.generateFromPrompt('夜跑')
    await store.generateFromPrompt('通勤')

    expect(store.recentPrompts).toEqual(['通勤', '夜跑'])
  })

  it('can reuse prompt by index and regenerate', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'ok', title: '推荐' }],
      draft: { name: '歌单', reason: 'ok', songs: [{ id: 1, name: 'song-1' }] },
      debug: { provider: 'llm' }
    })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('学习')
    await store.generateFromPrompt('专注')

    await store.reusePromptByIndex(1)

    expect(store.prompt).toBe('学习')
    const [, lastContext] = providerAdapter.recommend.mock.lastCall
    expect(providerAdapter.recommend.mock.lastCall[0]).toBe('学习')
    expect(lastContext).toMatchObject({
      maxSongs: 30,
      useLLM: true,
      providerMode: 'auto'
    })
    expect(Array.isArray(lastContext.messages)).toBe(true)
    expect(lastContext.messages.at(-1)).toMatchObject({ role: 'user', content: '学习' })
  })

  it('creates and switches sessions with isolated state', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'ok', title: '推荐' }],
      draft: { name: '歌单', reason: 'ok', songs: [{ id: 1, name: 'song-1' }] },
      debug: { provider: 'llm' }
    })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('会话A')

    const sessionAId = store.currentSessionId
    const newSessionId = store.createSession('会话B')
    expect(newSessionId).not.toBe(sessionAId)
    expect(store.currentSessionId).toBe(newSessionId)
    expect(store.prompt).toBe('')
    expect(store.chatMessages).toEqual([])

    await store.generateFromPrompt('会话B内容')
    expect(store.prompt).toBe('会话B内容')

    const switched = store.switchSession(sessionAId)
    expect(switched).toBe(true)
    expect(store.currentSessionId).toBe(sessionAId)
    expect(store.prompt).toBe('会话A')
    expect(store.chatMessages.some((msg) => msg.content === '会话A')).toBe(true)
  })

  it('renames untitled session using first prompt', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'ok', title: '推荐' }],
      draft: { name: '歌单', reason: 'ok', songs: [{ id: 1, name: 'song-1' }] },
      debug: { provider: 'llm' }
    })

    const store = useAiPlaylistStore()
    const current = store.sessions.find((s) => s.id === store.currentSessionId)
    expect(current.title).toContain('新会话')

    await store.generateFromPrompt('夜间学习模式')

    const renamed = store.sessions.find((s) => s.id === store.currentSessionId)
    expect(renamed.title).toContain('夜间学习模式')
  })

  it('supports manual session rename', () => {
    const store = useAiPlaylistStore()
    const sessionId = store.currentSessionId

    const ok = store.renameSession(sessionId, '我的常用会话')
    expect(ok).toBe(true)

    const renamed = store.sessions.find((s) => s.id === sessionId)
    expect(renamed.title).toBe('我的常用会话')
  })

  it('deletes session and switches to another session', () => {
    const store = useAiPlaylistStore()
    const first = store.currentSessionId
    const second = store.createSession('第二会话')

    const removed = store.deleteSession(first)
    expect(removed).toBe(true)
    expect(store.sessions.some((s) => s.id === first)).toBe(false)
    expect(store.currentSessionId).toBe(second)
  })

  it('does not delete the last session', () => {
    const store = useAiPlaylistStore()

    const removed = store.deleteSession(store.currentSessionId)

    expect(removed).toBe(false)
    expect(store.sessions).toHaveLength(1)
  })

  it('reorders sessions and keeps current session stable', () => {
    const store = useAiPlaylistStore()
    const first = store.currentSessionId
    const second = store.createSession('第二会话')
    const third = store.createSession('第三会话')

    expect(store.sessions.map((s) => s.id)).toEqual([third, second, first])

    const ok = store.reorderSessions(0, 2)
    expect(ok).toBe(true)
    expect(store.sessions.map((s) => s.id)).toEqual([second, first, third])
    expect(store.currentSessionId).toBe(third)
  })

  it('rejects invalid reorder indexes', () => {
    const store = useAiPlaylistStore()
    const ok = store.reorderSessions(0, 9)
    expect(ok).toBe(false)
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

    expect(providerAdapter.recommend).toHaveBeenCalledWith('通勤想听轻松中文歌', {
      maxSongs: 30,
      useLLM: true,
      providerMode: 'auto',
      messages: [{ role: 'user', content: '通勤想听轻松中文歌' }],
      baseSongs: []
    })
    expect(result).toMatchObject({ success: true })
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
    expect(store.recommendations).toHaveLength(1)
    expect(store.draftPlaylist).toMatchObject({
      name: '通勤歌单',
      songs: [{ id: 1, name: 'song-1' }]
    })
  })

  it('accepts optional prompt arg, trims it, and stores trimmed prompt', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [],
      draft: null
    })

    const store = useAiPlaylistStore()

    await store.generateFromPrompt('  夜跑电子乐  ')

    expect(providerAdapter.recommend).toHaveBeenCalledWith('夜跑电子乐', {
      maxSongs: 30,
      useLLM: true,
      providerMode: 'auto',
      messages: [{ role: 'user', content: '夜跑电子乐' }],
      baseSongs: []
    })
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
      failedSongs: [],
      failedSongDetails: []
    })
    expect(store.creating).toBe(false)
    expect(store.error).toBe('')
  })

  it('captures failure reasons when adding songs fails', async () => {
    const playlistStoreMock = {
      createLocalPlaylist: vi.fn().mockResolvedValue({ id: 'local-3', name: 'AI推荐歌单' }),
      addSongToLocalPlaylist: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('网络异常'))
    }
    usePlaylistStore.mockReturnValue(playlistStoreMock)

    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: '失败样例歌单',
      reason: 'reason',
      songs: [
        { id: 11, name: 'song-11' },
        { id: 22, name: 'song-22' }
      ]
    }

    const result = await store.createDraftToLocalPlaylist()

    expect(result.success).toBe(false)
    expect(result.failedSongDetails).toHaveLength(2)
    expect(result.failedSongDetails[0]).toMatchObject({
      song: { id: 11, name: 'song-11' },
      reason: '添加失败'
    })
    expect(result.failedSongDetails[1]).toMatchObject({
      song: { id: 22, name: 'song-22' },
      reason: '网络异常'
    })
  })

  it('marks partial status and keeps failed songs for retry', async () => {
    const playlistStoreMock = {
      createLocalPlaylist: vi.fn().mockResolvedValue({ id: 'local-2', name: 'AI推荐歌单' }),
      addSongToLocalPlaylist: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
    }
    usePlaylistStore.mockReturnValue(playlistStoreMock)

    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: 'AI夜跑歌单',
      reason: '根据你的提示生成',
      songs: [
        { id: 1, name: 'song-1' },
        { id: 2, name: 'song-2' },
        { id: 3, name: 'song-3' }
      ]
    }

    const result = await store.createDraftToLocalPlaylist()

    expect(result).toMatchObject({
      success: true,
      status: 'partial',
      partial: true,
      playlistId: 'local-2',
      addedSongs: 1,
      totalSongs: 3
    })
    expect(result.failedSongs).toHaveLength(2)
    expect(store.lastCreateResult).toMatchObject({
      playlistId: 'local-2',
      status: 'partial'
    })
  })

  it('retries failed songs based on last create result', async () => {
    const playlistStoreMock = {
      createLocalPlaylist: vi.fn(),
      addSongToLocalPlaylist: vi.fn().mockResolvedValue(true)
    }
    usePlaylistStore.mockReturnValue(playlistStoreMock)

    const store = useAiPlaylistStore()
    store.lastCreateResult = {
      playlistId: 'local-9',
      failedSongs: [
        { id: 10, name: 'song-10' },
        { id: 20, name: 'song-20' }
      ]
    }

    const result = await store.retryFailedSongsToLocalPlaylist()

    expect(playlistStoreMock.addSongToLocalPlaylist).toHaveBeenNthCalledWith(1, 'local-9', {
      id: 10,
      name: 'song-10'
    })
    expect(playlistStoreMock.addSongToLocalPlaylist).toHaveBeenNthCalledWith(2, 'local-9', {
      id: 20,
      name: 'song-20'
    })
    expect(result).toMatchObject({
      success: true,
      retried: 2,
      addedSongs: 2,
      failedSongs: []
    })
    expect(store.lastCreateResult.failedSongs).toEqual([])
  })

  it('keeps adjustment result as pending draft and can apply it', async () => {
    providerAdapter.recommend
      .mockResolvedValueOnce({
        recommendations: [{ id: 'base', title: '基础歌单' }],
        draft: {
          name: '基础歌单',
          reason: '初次生成',
          songs: [{ id: 1, name: 'song-1' }]
        },
        debug: { provider: 'llm' }
      })
      .mockResolvedValueOnce({
        recommendations: [{ id: 'adjusted', title: '调整后歌单' }],
        draft: {
          name: '调整后歌单',
          reason: '增强动感',
          songs: [
            { id: 1, name: 'song-1' },
            { id: 2, name: 'song-2' }
          ]
        },
        debug: { provider: 'llm', intent: '增强动感', reason: '增加电子和节奏感' }
      })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('通勤轻松')
    const result = await store.generateFromPrompt('再加一点电子')

    expect(result.success).toBe(true)
    expect(store.pendingDraftPlaylist).toMatchObject({ name: '调整后歌单' })
    expect(store.draftPlaylist).toMatchObject({ name: '基础歌单' })
    expect(store.lastAdjustmentMeta).toMatchObject({
      intent: '增强动感',
      reason: '增加电子和节奏感'
    })
    expect(store.pendingDraftDiff.addedSongs.map((song) => song.id)).toEqual([2])
    expect(store.pendingDraftDiff.removedSongs).toEqual([])
    expect(store.pendingDraftSelection.addedSongIds).toEqual([2])

    store.applyPendingDraft()
    expect(store.pendingDraftPlaylist).toBe(null)
    expect(store.draftPlaylist).toMatchObject({ name: '调整后歌单' })
    expect(store.pendingDraftDiff).toEqual({ addedSongs: [], removedSongs: [] })
  })

  it('rolls back to previous draft after apply', async () => {
    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: '旧歌单',
      reason: 'old',
      songs: [{ id: 1, name: 'song-1' }]
    }
    store.pendingDraftPlaylist = {
      name: '新歌单',
      reason: 'new',
      songs: [{ id: 2, name: 'song-2' }]
    }

    store.applyPendingDraft()
    expect(store.draftPlaylist.name).toBe('新歌单')

    const ok = store.rollbackDraft()
    expect(ok).toBe(true)
    expect(store.draftPlaylist.name).toBe('旧歌单')
  })

  it('applies pending draft with per-song selection', () => {
    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: '当前歌单',
      reason: 'current',
      songs: [
        { id: 1, name: 'song-1' },
        { id: 2, name: 'song-2' }
      ]
    }
    store.pendingDraftPlaylist = {
      name: '调整歌单',
      reason: 'adjust',
      songs: [
        { id: 2, name: 'song-2' },
        { id: 3, name: 'song-3' }
      ]
    }
    store.pendingDraftDiff = {
      addedSongs: [{ id: 3, name: 'song-3' }],
      removedSongs: [{ id: 1, name: 'song-1' }]
    }
    store.pendingDraftSelection = {
      addedSongIds: [3],
      removedSongIds: [1]
    }

    store.togglePendingAddedSong(3)
    store.applyPendingDraft()

    expect(store.draftPlaylist.songs.map((song) => song.id)).toEqual([2])
  })

  it('supports only-add mode to keep existing songs', () => {
    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: '当前歌单',
      reason: 'current',
      songs: [{ id: 1, name: 'song-1' }]
    }
    store.pendingDraftPlaylist = {
      name: '调整歌单',
      reason: 'adjust',
      songs: [{ id: 2, name: 'song-2' }]
    }
    store.pendingDraftDiff = {
      addedSongs: [{ id: 2, name: 'song-2' }],
      removedSongs: [{ id: 1, name: 'song-1' }]
    }
    store.pendingDraftSelection = {
      addedSongIds: [2],
      removedSongIds: [1]
    }

    store.setPendingApplyMode('only_add')
    store.applyPendingDraft()

    expect(store.draftPlaylist.songs.map((song) => song.id)).toEqual([1, 2])
  })

  it('supports bulk selection actions for pending diff songs', () => {
    const store = useAiPlaylistStore()
    store.pendingDraftDiff = {
      addedSongs: [
        { id: 2, name: 'song-2' },
        { id: 3, name: 'song-3' }
      ],
      removedSongs: [{ id: 1, name: 'song-1' }]
    }
    store.pendingDraftSelection = {
      addedSongIds: [],
      removedSongIds: []
    }

    store.selectAllPendingAddedSongs()
    expect(store.pendingDraftSelection.addedSongIds).toEqual([2, 3])

    store.clearPendingAddedSongs()
    expect(store.pendingDraftSelection.addedSongIds).toEqual([])

    store.selectAllPendingRemovedSongs()
    expect(store.pendingDraftSelection.removedSongIds).toEqual([1])

    store.clearPendingRemovedSongs()
    expect(store.pendingDraftSelection.removedSongIds).toEqual([])
  })

  it('adds fallback status message when llm fails and rule fallback is used', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'rule', title: '规则推荐' }],
      draft: {
        name: '规则歌单',
        reason: '规则兜底',
        songs: [{ id: 1, name: 'song-1' }]
      },
      debug: {
        provider: 'rule',
        fallback: 'rule',
        llmErrorType: 'auth'
      }
    })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('通勤轻松')

    const fallbackMessage = store.chatMessages.find(
      (msg) => msg.type === 'status' && msg.meta?.reason === 'auth'
    )
    expect(fallbackMessage).toBeTruthy()
    expect(fallbackMessage.content).toContain('鉴权失败')
  })

  it('records generation metrics for each prompt', async () => {
    providerAdapter.recommend
      .mockResolvedValueOnce({
        recommendations: [{ id: 'llm', title: 'LLM推荐' }],
        draft: {
          name: 'LLM歌单',
          reason: 'llm',
          songs: [{ id: 1, name: 'song-1' }]
        },
        debug: { provider: 'llm' }
      })
      .mockResolvedValueOnce({
        recommendations: [{ id: 'rule', title: '规则推荐' }],
        draft: {
          name: '规则歌单',
          reason: 'rule',
          songs: [{ id: 2, name: 'song-2' }]
        },
        debug: { provider: 'rule', fallback: 'rule', llmErrorType: 'timeout' }
      })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('第一次')
    await store.generateFromPrompt('第二次')

    expect(store.generationMetrics).toHaveLength(2)
    expect(store.generationMetrics[0]).toMatchObject({
      prompt: '第一次',
      provider: 'llm',
      fallback: false,
      success: true
    })
    expect(store.generationMetrics[1]).toMatchObject({
      prompt: '第二次',
      provider: 'rule',
      fallback: true,
      llmErrorType: 'timeout',
      success: true
    })
  })

  it('builds exportable debug snapshot payload', async () => {
    providerAdapter.recommend.mockResolvedValue({
      recommendations: [{ id: 'llm', title: 'LLM推荐' }],
      draft: {
        name: 'LLM歌单',
        reason: 'llm',
        songs: [{ id: 1, name: 'song-1' }]
      },
      debug: { provider: 'llm' }
    })

    const store = useAiPlaylistStore()
    await store.generateFromPrompt('导出测试')
    const snapshot = store.buildDebugSnapshot()

    expect(snapshot).toMatchObject({
      prompt: '导出测试',
      providerMode: 'auto',
      draftSongCount: 1
    })
    expect(Array.isArray(snapshot.chatMessages)).toBe(true)
    expect(Array.isArray(snapshot.generationMetrics)).toBe(true)
  })

  it('ignores stale response when a newer request finishes first', async () => {
    const first = createDeferred()
    const second = createDeferred()

    providerAdapter.recommend.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const store = useAiPlaylistStore()
    const firstCall = store.generateFromPrompt('第一次请求')
    const secondCall = store.generateFromPrompt('第二次请求')

    second.resolve({
      recommendations: [{ id: 'newer', title: '新结果' }],
      draft: { name: '新歌单', reason: 'new', songs: [{ id: 2, name: 'song-2' }] },
      debug: { provider: 'llm' }
    })
    await secondCall

    first.resolve({
      recommendations: [{ id: 'older', title: '旧结果' }],
      draft: { name: '旧歌单', reason: 'old', songs: [{ id: 1, name: 'song-1' }] },
      debug: { provider: 'llm' }
    })
    await firstCall

    expect(store.draftPlaylist.name).toBe('新歌单')
    expect(store.recommendations[0].id).toBe('newer')
  })

  it('supports canceling current generation and keeps current draft', async () => {
    const pending = createDeferred()
    providerAdapter.recommend.mockReturnValueOnce(pending.promise)

    const store = useAiPlaylistStore()
    store.draftPlaylist = { name: '已有草稿', reason: 'keep', songs: [{ id: 1, name: 'song-1' }] }

    const run = store.generateFromPrompt('长请求')
    store.cancelCurrentGeneration()

    pending.resolve({
      recommendations: [{ id: 'late', title: '晚到结果' }],
      draft: { name: '晚到草稿', reason: 'late', songs: [{ id: 2, name: 'song-2' }] },
      debug: { provider: 'llm' }
    })

    await run

    expect(store.loading).toBe(false)
    expect(store.draftPlaylist.name).toBe('已有草稿')
    expect(store.error).toContain('已取消')
  })
})
