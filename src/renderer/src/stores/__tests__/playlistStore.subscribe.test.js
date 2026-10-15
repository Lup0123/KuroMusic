import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlaylistStore } from '../playlistStore'

describe('playlistStore cloud subscribe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.window = { api: { subscribePlaylist: vi.fn() } }
  })

  const seed = (store) => {
    store.userPlaylists = [
      { id: 1, name: '我喜欢的音乐', subscribed: false },
      { id: 2, name: '自建', subscribed: false },
      { id: 3, name: '收藏的', subscribed: true }
    ]
  }

  it('splits cloud playlists into created and subscribed', () => {
    const store = usePlaylistStore()
    seed(store)
    expect(store.cloudCreatedPlaylists.map((p) => p.id)).toEqual([1, 2])
    expect(store.cloudSubscribedPlaylists.map((p) => p.id)).toEqual([3])
  })

  it('reports subscribed and own playlists with string/number ids', () => {
    const store = usePlaylistStore()
    seed(store)
    expect(store.isPlaylistSubscribed('3')).toBe(true)
    expect(store.isPlaylistSubscribed(2)).toBe(false)
    expect(store.isOwnCloudPlaylist('2')).toBe(true)
    expect(store.isOwnCloudPlaylist(3)).toBe(false)
    expect(store.isOwnCloudPlaylist(99)).toBe(false)
  })

  it('adds the playlist to subscribed list on success', async () => {
    const store = usePlaylistStore()
    seed(store)
    window.api.subscribePlaylist.mockResolvedValue({ code: 200 })

    const result = await store.toggleSubscribePlaylist({ id: 9, name: '新收藏' }, true)

    expect(window.api.subscribePlaylist).toHaveBeenCalledWith(9, true)
    expect(result.success).toBe(true)
    expect(store.isPlaylistSubscribed(9)).toBe(true)
  })

  it('removes only the subscribed entry on unsubscribe', async () => {
    const store = usePlaylistStore()
    seed(store)
    window.api.subscribePlaylist.mockResolvedValue({ code: 200 })

    await store.toggleSubscribePlaylist({ id: 3 }, false)

    expect(store.isPlaylistSubscribed(3)).toBe(false)
    expect(store.userPlaylists.map((p) => p.id)).toEqual([1, 2])
  })

  it('keeps state and returns the server message on failure', async () => {
    const store = usePlaylistStore()
    seed(store)
    window.api.subscribePlaylist.mockResolvedValue({ code: 400, message: '操作频繁' })

    const result = await store.toggleSubscribePlaylist({ id: 3 }, false)

    expect(result).toEqual({ success: false, message: '操作频繁' })
    expect(store.isPlaylistSubscribed(3)).toBe(true)
  })
})
