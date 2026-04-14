import { defineStore } from 'pinia'

const PLAYBACK_STATE_STORAGE_KEY = 'playerPlaybackState'

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function safeReadPlaybackState() {
  try {
    const raw = localStorage.getItem(PLAYBACK_STATE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (error) {
    console.error('读取播放状态失败:', error)
    return null
  }
}

function safeWritePlaybackState(payload) {
  try {
    localStorage.setItem(PLAYBACK_STATE_STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.error('保存播放状态失败:', error)
  }
}

function normalizeRestoredPlaylist(playlist) {
  return playlist.map((song) => {
    if (!song || typeof song !== 'object') return song

    const hasLocalPath = typeof song.path === 'string' && song.path.trim() !== ''
    if (hasLocalPath) return song

    const normalized = { ...song }
    delete normalized.url
    return normalized
  })
}

export const useSongStore = defineStore('song', {
  state: () => ({
    playlist: [],
    currentSongIndex: -1,
    isPlaying: false,
    showPlaylist: false,
    showLyric: false,
    currentTime: 0,
    duration: 0,
    volume: 70,
    lyric: '',
    audioElement: null,
    playMode: 'list' // 'list', 'single', 'random'
  }),

  getters: {
    currentSong: (state) => {
      if (state.currentSongIndex >= 0 && state.currentSongIndex < state.playlist.length) {
        return state.playlist[state.currentSongIndex]
      }
      return {
        id: '',
        name: '暂无播放',
        artist: '未知艺术家',
        album: '未知专辑',
        cover: 'https://via.placeholder.com/50',
        duration: '00:00'
      }
    },

    progress: (state) => {
      if (state.duration === 0) return 0
      return (state.currentTime / state.duration) * 100
    },

    formattedCurrentTime: (state) => formatTime(state.currentTime),
    formattedDuration: (state) => formatTime(state.duration),

    hasNextSong: (state) => state.currentSongIndex < state.playlist.length - 1,
    hasPreviousSong: (state) => state.currentSongIndex > 0
  },

  actions: {
    // 替换整个播放列表
    replacePlaylist(songs) {
      this.playlist = [...songs]
      this.currentSongIndex = -1
      this.isPlaying = false
      this.persistPlaybackState()
    },

    // 从指定索引开始播放
    playFromIndex(index) {
      if (index >= 0 && index < this.playlist.length) {
        this.currentSongIndex = index
        this.isPlaying = true
        this.currentTime = 0
        this.persistPlaybackState()
      }
    },

    // 播放指定歌曲(添加到列表)
    play(song) {
      const index = this.playlist.findIndex((item) => item.id === song.id)
      if (index === -1) {
        this.playlist.push(song)
        this.currentSongIndex = this.playlist.length - 1
      } else {
        this.currentSongIndex = index
      }
      this.isPlaying = true
      this.currentTime = 0
      this.persistPlaybackState()
    },

    addToPlaylist(song) {
      const exists = this.playlist.some((item) => item.id === song.id)
      if (!exists) {
        this.playlist.push(song)
        this.persistPlaybackState()
      }
    },

    removeFromPlaylist(index) {
      if (index === this.currentSongIndex) {
        if (this.playlist.length > 1) {
          this.playNext()
        } else {
          this.currentSongIndex = -1
          this.isPlaying = false
        }
      } else if (index < this.currentSongIndex) {
        this.currentSongIndex--
      }
      this.playlist.splice(index, 1)
      this.persistPlaybackState()
    },

    togglePlay() {
      if (this.playlist.length === 0) return
      if (this.currentSongIndex === -1) {
        this.currentSongIndex = 0
      }
      this.isPlaying = !this.isPlaying
      this.persistPlaybackState()
    },

    playNext() {
      if (this.playlist.length === 0) return

      if (this.playMode === 'single') {
        this.currentTime = 0
        this.isPlaying = true
        return
      }

      if (this.playMode === 'random') {
        this.currentSongIndex = Math.floor(Math.random() * this.playlist.length)
      } else {
        this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length
      }

      this.isPlaying = true
      this.currentTime = 0
      this.persistPlaybackState()
    },

    playPrevious() {
      if (this.playlist.length === 0) return

      this.currentSongIndex = this.currentSongIndex - 1
      if (this.currentSongIndex < 0) {
        this.currentSongIndex = this.playlist.length - 1
      }
      this.isPlaying = true
      this.currentTime = 0
      this.persistPlaybackState()
    },

    togglePlaylist() {
      this.showPlaylist = !this.showPlaylist
    },

    toggleLyric() {
      this.showLyric = !this.showLyric
    },

    setCurrentTime(time) {
      const previousSecond = Math.floor(this.currentTime || 0)
      this.currentTime = time
      const currentSecond = Math.floor(this.currentTime || 0)
      if (currentSecond !== previousSecond) {
        this.persistPlaybackState()
      }
    },

    setDuration(time) {
      this.duration = time
    },

    setVolume(vol) {
      this.volume = Math.max(0, Math.min(100, vol))
      this.persistPlaybackState()
    },

    setProgress(prog) {
      if (this.duration > 0) {
        this.currentTime = (prog / 100) * this.duration
        this.persistPlaybackState()
      }
    },

    setLyric(ly) {
      this.lyric = ly
    },

    setPlayMode(mode) {
      this.playMode = mode
      this.persistPlaybackState()
    },

    setPlaying(playing) {
      this.isPlaying = Boolean(playing)
      this.persistPlaybackState()
    },

    persistPlaybackState() {
      const playlist = Array.isArray(this.playlist) ? this.playlist : []
      const maxIndex = playlist.length - 1
      const currentSongIndex = clampNumber(this.currentSongIndex, -1, maxIndex, -1)

      safeWritePlaybackState({
        version: 1,
        playlist,
        currentSongIndex,
        currentTime: Math.max(0, Number(this.currentTime) || 0),
        volume: clampNumber(this.volume, 0, 100, 70),
        playMode: ['list', 'single', 'random'].includes(this.playMode) ? this.playMode : 'list'
      })
    },

    restorePlaybackState() {
      const saved = safeReadPlaybackState()
      if (!saved) return

      const rawPlaylist = Array.isArray(saved.playlist) ? saved.playlist : []
      const playlist = normalizeRestoredPlaylist(rawPlaylist)
      const maxIndex = playlist.length - 1

      this.playlist = playlist
      this.currentSongIndex =
        maxIndex >= 0 ? clampNumber(saved.currentSongIndex, -1, maxIndex, -1) : -1
      this.currentTime = Math.max(0, Number(saved.currentTime) || 0)
      this.volume = clampNumber(saved.volume, 0, 100, 70)
      this.playMode = ['list', 'single', 'random'].includes(saved.playMode)
        ? saved.playMode
        : 'list'
      this.isPlaying = false

      this.persistPlaybackState()
    }
  }
})

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
