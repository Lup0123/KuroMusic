import { defineStore } from 'pinia'

export const useSongStore = defineStore('song', {
  state: () => ({
    playlist: [],
    currentSongIndex: -1,
    isPlaying: false,
    showPlaylist: false,
    showLyric: false, // 新增歌词显示状态
    currentTime: 0,
    duration: 0,
    volume: 70,
    lyric: '',
    audioElement: null // 新增：存储 audio 元素引用
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
        duration: '00:00',
        path: '',
        type: '',
        size: '',
        br: ''
      }
    },

    progress: (state) => {
      if (state.duration === 0) return 0
      return (state.currentTime / state.duration) * 100
    },

    formattedCurrentTime: (state) => {
      return formatTime(state.currentTime)
    },

    formattedDuration: (state) => {
      return formatTime(state.duration)
    }
  },

  actions: {
    play(song) {
      // 如果歌曲不在播放列表中,添加到播放列表
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
        // 如果删除的是当前播放的歌曲
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
      if (this.playlist.length === 0) {
        return
      }
      if (this.currentSongIndex === -1) {
        this.currentSongIndex = 0
      }
      this.isPlaying = !this.isPlaying
    },

    playNext() {
      if (this.playlist.length === 0) return
      this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length
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

    setCurrentTime(time) {
      this.currentTime = time
    },

    setDuration(time) {
      this.duration = time
    },

    setVolume(vol) {
      this.volume = vol
    },

    setProgress(prog) {
      if (this.duration > 0) {
        this.currentTime = (prog / 100) * this.duration
      }
    },

    setLyric(ly) {
      this.lyric = ly
    }
  }
})

// 工具函数
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
