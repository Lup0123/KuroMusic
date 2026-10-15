import { defineStore } from 'pinia'

const PLAYBACK_STATE_STORAGE_KEY = 'playerPlaybackState'
// 音量/静音单独存储：只由音量操作写入，避免其他窗口（AI 助手）写播放状态时用旧快照覆盖
const VOLUME_STORAGE_KEY = 'playerVolume'
const DEFAULT_VOLUME = 70
// 在音量为 0 时取消静音，恢复到的音量
const UNMUTE_FALLBACK_VOLUME = 50

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

function safeReadVolumeState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOLUME_STORAGE_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
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
    volume: DEFAULT_VOLUME,
    muted: false,
    lyric: '',
    audioElement: null,
    playMode: 'list', // 'list', 'single', 'random'
    shuffleOrder: [],
    shuffleCursor: -1
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
        cover: '',
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
      this.rebuildShuffleOrder()
      this.persistPlaybackState()
    },

    // 从指定索引开始播放
    playFromIndex(index) {
      if (index >= 0 && index < this.playlist.length) {
        this.currentSongIndex = index
        this.isPlaying = true
        this.currentTime = 0
        this.rebuildShuffleOrder()
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
      this.rebuildShuffleOrder()
      this.persistPlaybackState()
    },

    addToPlaylist(song) {
      const exists = this.playlist.some((item) => item.id === song.id)
      if (!exists) {
        this.playlist.push(song)
        this.rebuildShuffleOrder()
        this.persistPlaybackState()
      }
    },

    playSongNext(song) {
      if (!song?.id) return
      if (this.playlist.length === 0 || this.currentSongIndex < 0) {
        this.addToPlaylist(song)
        return
      }

      const existingIndex = this.playlist.findIndex((item) => item.id === song.id)
      if (existingIndex === this.currentSongIndex) return

      if (existingIndex !== -1) {
        this.playlist.splice(existingIndex, 1)
        if (existingIndex < this.currentSongIndex) {
          this.currentSongIndex--
        }
      }

      const insertIndex = this.currentSongIndex + 1
      this.playlist.splice(insertIndex, 0, song)
      this.rebuildShuffleOrder()
      this.persistPlaybackState()
    },

    removeSongsByIds(songIds) {
      const ids = new Set(songIds.filter((id) => id !== undefined && id !== null))
      if (ids.size === 0) return

      const originalPlaylist = this.playlist
      const currentIndex = this.currentSongIndex
      const currentSong = currentIndex >= 0 ? originalPlaylist[currentIndex] : null
      const currentRemoved = Boolean(currentSong && ids.has(currentSong.id))
      const removedBeforeCurrent =
        currentIndex >= 0
          ? originalPlaylist.slice(0, currentIndex).filter((song) => ids.has(song.id)).length
          : 0

      this.playlist = originalPlaylist.filter((song) => !ids.has(song.id))

      if (this.playlist.length === 0) {
        this.currentSongIndex = -1
        this.isPlaying = false
      } else if (currentRemoved) {
        this.currentSongIndex = Math.min(currentIndex, this.playlist.length - 1)
        this.isPlaying = true
        this.currentTime = 0
      } else if (currentIndex >= 0) {
        this.currentSongIndex = currentIndex - removedBeforeCurrent
      }

      this.rebuildShuffleOrder()
      this.persistPlaybackState()
    },

    removeFromPlaylist(index) {
      this.playlist.splice(index, 1)
      this.rebuildShuffleOrder()

      if (this.playlist.length === 0) {
        this.currentSongIndex = -1
        this.isPlaying = false
      } else if (index === this.currentSongIndex) {
        this.currentSongIndex = Math.min(index, this.playlist.length - 1)
        this.isPlaying = true
        this.currentTime = 0
      } else if (index < this.currentSongIndex) {
        this.currentSongIndex--
      }
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

    playNext(options = {}) {
      if (this.playlist.length === 0) return
      const auto = Boolean(options?.auto)

      if (!auto) {
        const current = this.currentSong
        if (current?.id) {
          globalThis?.window?.api
            ?.behaviorRecordEvent?.({
              type: 'skip',
              song: {
                id: current.id,
                name: current.name,
                artist: current.artist
              }
            })
            ?.catch?.(() => {})
        }
      }

      if (this.playMode === 'single' && auto) {
        this.currentTime = 0
        this.isPlaying = true
        return
      }

      if (this.playMode === 'random') {
        const nextIndex = this.takeNextShuffleIndex()
        if (nextIndex === -1) return
        this.currentSongIndex = nextIndex
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
      this.volume = clampNumber(vol, 0, 100, this.volume)
      // 拖动音量即视为取消静音
      if (this.volume > 0) this.muted = false
      this.persistVolumeState()
    },

    toggleMute() {
      if (this.muted || this.volume === 0) {
        this.muted = false
        if (this.volume === 0) this.volume = UNMUTE_FALLBACK_VOLUME
      } else {
        this.muted = true
      }
      this.persistVolumeState()
    },

    persistVolumeState() {
      try {
        localStorage.setItem(
          VOLUME_STORAGE_KEY,
          JSON.stringify({ volume: this.volume, muted: this.muted })
        )
      } catch (error) {
        console.error('保存音量失败:', error)
      }
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
      if (!['list', 'random', 'single'].includes(mode)) return
      this.playMode = mode
      if (mode === 'random') {
        this.rebuildShuffleOrder()
      }
      this.persistPlaybackState()
    },

    cyclePlayMode() {
      const order = ['list', 'random', 'single']
      const currentIndex = order.indexOf(this.playMode)
      const next = order[(currentIndex + 1) % order.length]
      this.setPlayMode(next)
    },

    rebuildShuffleOrder(includeCurrent = false) {
      const length = this.playlist.length
      if (length === 0) {
        this.shuffleOrder = []
        this.shuffleCursor = -1
        return
      }

      let indices = Array.from({ length }, (_, index) => index)
      if (
        !includeCurrent &&
        this.currentSongIndex >= 0 &&
        this.currentSongIndex < length &&
        length > 1
      ) {
        indices = indices.filter((index) => index !== this.currentSongIndex)
      }

      this.shuffleOrder = shuffleArray(indices)
      this.shuffleCursor = -1
    },

    ensureShuffleBag() {
      if (this.playlist.length === 0) return
      if (this.shuffleOrder.length > 0) return
      this.rebuildShuffleOrder()
    },

    takeNextShuffleIndex() {
      if (this.playlist.length === 0) return -1
      this.ensureShuffleBag()
      if (this.shuffleOrder.length === 0) return -1
      if (this.shuffleCursor >= this.shuffleOrder.length - 1) {
        this.rebuildShuffleOrder(true)
      }
      this.shuffleCursor += 1
      return this.shuffleOrder[this.shuffleCursor]
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
        playMode: ['list', 'single', 'random'].includes(this.playMode) ? this.playMode : 'list'
      })
    },

    restorePlaybackState() {
      // 音量独立恢复；兼容旧版本存在播放状态里的 volume
      const savedVolume = safeReadVolumeState()
      const saved = safeReadPlaybackState()
      this.volume = clampNumber(savedVolume?.volume ?? saved?.volume, 0, 100, DEFAULT_VOLUME)
      this.muted = Boolean(savedVolume?.muted)
      if (!saved) return

      const rawPlaylist = Array.isArray(saved.playlist) ? saved.playlist : []
      const playlist = normalizeRestoredPlaylist(rawPlaylist)
      const maxIndex = playlist.length - 1

      this.playlist = playlist
      this.currentSongIndex =
        maxIndex >= 0 ? clampNumber(saved.currentSongIndex, -1, maxIndex, -1) : -1
      this.currentTime = Math.max(0, Number(saved.currentTime) || 0)
      this.playMode = ['list', 'single', 'random'].includes(saved.playMode)
        ? saved.playMode
        : 'list'
      this.isPlaying = false

      if (this.playMode === 'random') {
        this.rebuildShuffleOrder()
      }

      this.persistPlaybackState()
    }
  }
})

function shuffleArray(array) {
  const result = [...array]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = current
  }
  return result
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
