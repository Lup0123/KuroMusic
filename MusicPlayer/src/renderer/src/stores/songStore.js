import { defineStore } from 'pinia'

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
    },

    // 从指定索引开始播放
    playFromIndex(index) {
      if (index >= 0 && index < this.playlist.length) {
        this.currentSongIndex = index
        this.isPlaying = true
        this.currentTime = 0
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
    },

    addToPlaylist(song) {
      const exists = this.playlist.some((item) => item.id === song.id)
      if (!exists) {
        this.playlist.push(song)
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
    },

    togglePlay() {
      if (this.playlist.length === 0) return
      if (this.currentSongIndex === -1) {
        this.currentSongIndex = 0
      }
      this.isPlaying = !this.isPlaying
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
    },

    playPrevious() {
      if (this.playlist.length === 0) return

      this.currentSongIndex = this.currentSongIndex - 1
      if (this.currentSongIndex < 0) {
        this.currentSongIndex = this.playlist.length - 1
      }
      this.isPlaying = true
      this.currentTime = 0
    },

    togglePlaylist() {
      this.showPlaylist = !this.showPlaylist
    },

    toggleLyric() {
      this.showLyric = !this.showLyric
    },

    setCurrentTime(time) {
      this.currentTime = time
    },

    setDuration(time) {
      this.duration = time
    },

    setVolume(vol) {
      this.volume = Math.max(0, Math.min(100, vol))
    },

    setProgress(prog) {
      if (this.duration > 0) {
        this.currentTime = (prog / 100) * this.duration
      }
    },

    setLyric(ly) {
      this.lyric = ly
    },

    setPlayMode(mode) {
      this.playMode = mode
    }
  }
})

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
