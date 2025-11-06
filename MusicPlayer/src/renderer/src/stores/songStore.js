import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSongStore = defineStore('song', () => {
  // 状态
  const playlist = ref([])
  const currentSongIndex = ref(-1)
  const isPlaying = ref(false)
  const showPlaylist = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(70)

  // 计算属性
  const currentSong = computed(() => {
    if (
      currentSongIndex.value >= 0 &&
      currentSongIndex.value < playlist.value.length
    ) {
      return playlist.value[currentSongIndex.value]
    }
    return {
      id: '',
      name: '暂无播放',
      artist: '未知艺术家',
      album: '未知专辑',
      cover: 'https://via.placeholder.com/50',
      duration: '00:00',
      path: ''
    }
  })

  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  const formattedCurrentTime = computed(() => {
    return formatTime(currentTime.value)
  })

  const formattedDuration = computed(() => {
    return formatTime(duration.value)
  })

  // 方法
  const playSong = (song) => {
    // 如果歌曲不在播放列表中,添加到播放列表
    const index = playlist.value.findIndex((item) => item.id === song.id)
    if (index === -1) {
      playlist.value.push(song)
      currentSongIndex.value = playlist.value.length - 1
    } else {
      currentSongIndex.value = index
    }
    isPlaying.value = true
    currentTime.value = 0
  }

  const addToPlaylist = (song) => {
    const exists = playlist.value.some((item) => item.id === song.id)
    if (!exists) {
      playlist.value.push(song)
    }
  }

  const removeFromPlaylist = (index) => {
    if (index === currentSongIndex.value) {
      // 如果删除的是当前播放的歌曲
      if (playlist.value.length > 1) {
        playNext()
      } else {
        currentSongIndex.value = -1
        isPlaying.value = false
      }
    } else if (index < currentSongIndex.value) {
      currentSongIndex.value--
    }
    playlist.value.splice(index, 1)
  }

  const togglePlay = () => {
    if (playlist.value.length === 0) {
      return
    }
    if (currentSongIndex.value === -1) {
      currentSongIndex.value = 0
    }
    isPlaying.value = !isPlaying.value
  }

  const playNext = () => {
    if (playlist.value.length === 0) return
    currentSongIndex.value =
      (currentSongIndex.value + 1) % playlist.value.length
    isPlaying.value = true
    currentTime.value = 0
  }

  const playPrevious = () => {
    if (playlist.value.length === 0) return
    currentSongIndex.value = currentSongIndex.value - 1
    if (currentSongIndex.value < 0) {
      currentSongIndex.value = playlist.value.length - 1
    }
    isPlaying.value = true
    currentTime.value = 0
  }

  const togglePlaylist = () => {
    showPlaylist.value = !showPlaylist.value
  }

  const setCurrentTime = (time) => {
    currentTime.value = time
  }

  const setDuration = (time) => {
    duration.value = time
  }

  const setVolume = (vol) => {
    volume.value = vol
  }

  const setProgress = (prog) => {
    if (duration.value > 0) {
      currentTime.value = (prog / 100) * duration.value
    }
  }

  // 工具函数
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  return {
    // 状态
    playlist,
    currentSongIndex,
    isPlaying,
    showPlaylist,
    currentTime,
    duration,
    volume,
    // 计算属性
    currentSong,
    progress,
    formattedCurrentTime,
    formattedDuration,
    // 方法
    playSong,
    addToPlaylist,
    removeFromPlaylist,
    togglePlay,
    playNext,
    playPrevious,
    togglePlaylist,
    setCurrentTime,
    setDuration,
    setVolume,
    setProgress
  }
})
