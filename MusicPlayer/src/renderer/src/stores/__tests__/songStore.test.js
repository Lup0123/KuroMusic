import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSongStore } from '../songStore'

const SONGS = [
  { id: 1, name: 'Song A', artist: 'Artist A', album: 'Album A', duration: '03:00' },
  { id: 2, name: 'Song B', artist: 'Artist B', album: 'Album B', duration: '03:30' },
  { id: 3, name: 'Song C', artist: 'Artist C', album: 'Album C', duration: '04:00' }
]

describe('songStore', () => {
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

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    globalThis.localStorage = createMemoryStorage()
    localStorage.clear()
  })

  it('has spec-compliant default state', () => {
    const store = useSongStore()
    expect(store.playlist).toEqual([])
    expect(store.currentSongIndex).toBe(-1)
    expect(store.playMode).toBe('list')
    expect(store.shuffleOrder).toEqual([])
    expect(store.shuffleCursor).toBe(-1)
  })

  it('cycles play mode in order and persists each step', () => {
    const store = useSongStore()
    store.cyclePlayMode()
    expect(store.playMode).toBe('random')
    store.cyclePlayMode()
    expect(store.playMode).toBe('single')
    store.cyclePlayMode()
    expect(store.playMode).toBe('list')

    const saved = JSON.parse(localStorage.getItem('playerPlaybackState'))
    expect(saved.playMode).toBe('list')
  })

  it('ignores invalid play mode values', () => {
    const store = useSongStore()
    store.setPlayMode('bogus')
    expect(store.playMode).toBe('list')
  })

  it('persists and restores playback state', () => {
    const store = useSongStore()
    store.playlist = [...SONGS]
    store.currentSongIndex = 1
    store.setPlayMode('random')
    store.setVolume(35)
    store.setCurrentTime(42)

    const restored = useSongStore()
    restored.restorePlaybackState()
    expect(restored.playlist).toHaveLength(3)
    expect(restored.currentSongIndex).toBe(1)
    expect(restored.playMode).toBe('random')
    expect(restored.volume).toBe(35)
    expect(restored.currentTime).toBe(42)
    expect(restored.isPlaying).toBe(false)
  })

  describe('playNext in list mode', () => {
    it('advances and wraps around', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0

      store.playNext()
      expect(store.currentSongIndex).toBe(1)
      store.playNext()
      expect(store.currentSongIndex).toBe(2)
      store.playNext()
      expect(store.currentSongIndex).toBe(0)
    })
  })

  describe('single loop mode', () => {
    it('repeats the current song on natural end', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1
      store.setPlayMode('single')
      store.setCurrentTime(99)

      store.playNext({ auto: true })
      expect(store.currentSongIndex).toBe(1)
      expect(store.currentTime).toBe(0)
      expect(store.isPlaying).toBe(true)
    })

    it('advances to the next song on manual next', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1
      store.setPlayMode('single')

      store.playNext()
      expect(store.currentSongIndex).toBe(2)
    })
  })

  describe('random mode', () => {
    it('plays every other song exactly once before reshuffling', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0
      store.setPlayMode('random')

      const played = new Set()
      for (let index = 0; index < SONGS.length - 1; index += 1) {
        store.playNext({ auto: true })
        played.add(store.currentSongIndex)
      }

      expect(played.size).toBe(SONGS.length - 1)
      expect(played.has(0)).toBe(false)
    })

    it('keeps producing valid indices after the bag is exhausted', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0
      store.setPlayMode('random')

      for (let index = 0; index < SONGS.length * 2; index += 1) {
        store.playNext({ auto: true })
        expect(store.currentSongIndex).toBeGreaterThanOrEqual(0)
        expect(store.currentSongIndex).toBeLessThan(SONGS.length)
      }
    })
  })

  describe('removeFromPlaylist', () => {
    it('removing a song before the current one shifts the index back', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 2

      store.removeFromPlaylist(0)
      expect(store.playlist).toHaveLength(2)
      expect(store.currentSongIndex).toBe(1)
    })

    it('removing the current song plays the song that takes its place', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1

      store.removeFromPlaylist(1)
      expect(store.playlist).toHaveLength(2)
      expect(store.currentSongIndex).toBe(1)
      expect(store.isPlaying).toBe(true)
    })

    it('removing the current song at the end plays the new last song', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 2

      store.removeFromPlaylist(2)
      expect(store.playlist).toHaveLength(2)
      expect(store.currentSongIndex).toBe(1)
    })

    it('keeps a valid index when removing the current song from a 2-song list', () => {
      const store = useSongStore()
      store.playlist = SONGS.slice(0, 2)
      store.currentSongIndex = 0

      store.removeFromPlaylist(0)
      expect(store.playlist).toHaveLength(1)
      expect(store.currentSongIndex).toBe(0)
    })

    it('stops playback when the last song is removed', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0

      store.removeFromPlaylist(0)
      store.removeFromPlaylist(0)
      store.removeFromPlaylist(0)
      expect(store.playlist).toHaveLength(0)
      expect(store.currentSongIndex).toBe(-1)
      expect(store.isPlaying).toBe(false)
    })
  })

  describe('playSongNext', () => {
    it('inserts a new song right after the current song', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0

      store.playSongNext({ id: 99, name: 'Song X', artist: 'Artist X' })
      expect(store.playlist.map((song) => song.id)).toEqual([1, 99, 2, 3])
      expect(store.currentSongIndex).toBe(0)
    })

    it('moves an existing song after the current song without duplicating', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0

      store.playSongNext(SONGS[2])
      expect(store.playlist.map((song) => song.id)).toEqual([1, 3, 2])
      expect(store.currentSongIndex).toBe(0)
    })

    it('is a no-op when the song is already the current song', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1

      store.playSongNext(SONGS[1])
      expect(store.playlist.map((song) => song.id)).toEqual([1, 2, 3])
      expect(store.currentSongIndex).toBe(1)
    })

    it('appends to the playlist when nothing is playing', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = -1

      store.playSongNext({ id: 99, name: 'Song X' })
      expect(store.playlist.map((song) => song.id)).toEqual([1, 2, 3, 99])
    })

    it('appends when the playlist is empty', () => {
      const store = useSongStore()

      store.playSongNext({ id: 99, name: 'Song X' })
      expect(store.playlist.map((song) => song.id)).toEqual([99])
    })
  })

  describe('removeSongsByIds', () => {
    it('removes selected songs and keeps the current song', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1

      store.removeSongsByIds([SONGS[0].id, SONGS[2].id])
      expect(store.playlist.map((song) => song.id)).toEqual([2])
      expect(store.currentSongIndex).toBe(0)
    })

    it('adjusts the current index when songs before it are removed', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 2

      store.removeSongsByIds([SONGS[0].id])
      expect(store.playlist.map((song) => song.id)).toEqual([2, 3])
      expect(store.currentSongIndex).toBe(1)
    })

    it('plays the replacement song when the current song is removed', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1

      store.removeSongsByIds([SONGS[1].id])
      expect(store.playlist.map((song) => song.id)).toEqual([1, 3])
      expect(store.currentSongIndex).toBe(1)
      expect(store.isPlaying).toBe(true)
    })

    it('keeps a valid index when the last song is removed', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 2

      store.removeSongsByIds([SONGS[2].id])
      expect(store.playlist.map((song) => song.id)).toEqual([1, 2])
      expect(store.currentSongIndex).toBe(1)
    })

    it('stops playback when all songs are removed', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 0

      store.removeSongsByIds(SONGS.map((song) => song.id))
      expect(store.playlist).toHaveLength(0)
      expect(store.currentSongIndex).toBe(-1)
      expect(store.isPlaying).toBe(false)
    })

    it('ignores unknown ids', () => {
      const store = useSongStore()
      store.playlist = [...SONGS]
      store.currentSongIndex = 1

      store.removeSongsByIds([999])
      expect(store.playlist).toHaveLength(3)
      expect(store.currentSongIndex).toBe(1)
    })
  })
})
