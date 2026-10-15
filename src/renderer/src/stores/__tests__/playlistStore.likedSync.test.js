import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlaylistStore } from '../playlistStore'
import { useUserStore } from '../userStore'

describe('playlistStore liked sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useRealTimers()
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
    globalThis.window = { api: { getLikedSongs: vi.fn() } }
    useUserStore().setUserInfo({ userId: 42 })
  })

  it('replaces liked ids with the latest cloud list', async () => {
    const store = usePlaylistStore()
    store.likedSongIds = new Set([1, 2])
    window.api.getLikedSongs.mockResolvedValue([2, 3])

    await store.refreshLikedSongs({ force: true })

    expect(window.api.getLikedSongs).toHaveBeenCalledWith(42)
    expect([...store.likedSongIds]).toEqual([2, 3])
  })

  it('keeps existing liked ids when the request fails', async () => {
    const store = usePlaylistStore()
    store.likedSongIds = new Set([1, 2])

    window.api.getLikedSongs.mockResolvedValue(null)
    await store.refreshLikedSongs({ force: true })
    expect([...store.likedSongIds]).toEqual([1, 2])

    window.api.getLikedSongs.mockRejectedValue(new Error('network'))
    await store.refreshLikedSongs({ force: true })
    expect([...store.likedSongIds]).toEqual([1, 2])
  })

  it('shares one request between concurrent refreshes', async () => {
    const store = usePlaylistStore()
    let resolve
    window.api.getLikedSongs.mockReturnValue(new Promise((r) => (resolve = r)))

    const a = store.refreshLikedSongs({ force: true })
    const b = store.refreshLikedSongs({ force: true })
    resolve([7])
    await Promise.all([a, b])

    expect(window.api.getLikedSongs).toHaveBeenCalledTimes(1)
    expect(store.isSongLiked(7)).toBe(true)
  })

  it('skips non-forced refreshes within the minimum interval', async () => {
    const store = usePlaylistStore()
    window.api.getLikedSongs.mockResolvedValue([1])

    await store.refreshLikedSongs({ force: true })
    await store.refreshLikedSongs()

    expect(window.api.getLikedSongs).toHaveBeenCalledTimes(1)
  })

  it('does nothing when logged out', async () => {
    useUserStore().setUserInfo(null)
    const store = usePlaylistStore()
    await store.refreshLikedSongs({ force: true })
    expect(window.api.getLikedSongs).not.toHaveBeenCalled()
  })

  it('applies like changes broadcast from other windows', () => {
    const store = usePlaylistStore()
    store.applyLikedChange(5, true)
    expect(store.isSongLiked(5)).toBe(true)
    store.applyLikedChange(5, false)
    expect(store.isSongLiked(5)).toBe(false)
  })
})
