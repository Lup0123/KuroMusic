import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiPlaylistStore } from '../aiPlaylistStore'

vi.mock('../../services/ai/providerAdapter', () => ({
  recommend: vi.fn()
}))

vi.mock('../playlistStore', () => ({
  usePlaylistStore: vi.fn()
}))

function createMemoryStorage() {
  const store = {}
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    }
  }
}

describe('aiPlaylistStore rerank', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    globalThis.localStorage = createMemoryStorage()
    localStorage.clear()
  })

  it('reorders draft songs and keeps highlights after rerank', async () => {
    const songs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Song ${index + 1}`,
      artist: 'Artist'
    }))
    const store = useAiPlaylistStore()
    store.draftPlaylist = { name: '测试', reason: '', songs }

    globalThis.window = {
      api: {
        aiRerankCandidates: vi.fn(async () => ({
          success: true,
          order: ['12', '1', ...songs.slice(1, 11).map((song) => String(song.id))],
          highlights: [{ id: '12', reason: '节奏最佳' }]
        }))
      }
    }

    const result = await store.rerankDraft()

    expect(result.success).toBe(true)
    expect(store.draftPlaylist.songs[0].id).toBe(12)
    expect(store.draftPlaylist.songs[1].id).toBe(1)
    expect(store.rerankHighlights).toEqual([{ id: '12', reason: '节奏最佳' }])
    expect(store.reranking).toBe(false)
    delete globalThis.window
  })

  it('returns too_few without calling the api for short drafts', async () => {
    const store = useAiPlaylistStore()
    store.draftPlaylist = {
      name: '测试',
      reason: '',
      songs: [{ id: 1, name: 'A', artist: 'X' }]
    }
    globalThis.window = { api: { aiRerankCandidates: vi.fn() } }

    const result = await store.rerankDraft()

    expect(result.reason).toBe('too_few')
    expect(globalThis.window.api.aiRerankCandidates).not.toHaveBeenCalled()
    delete globalThis.window
  })
})
