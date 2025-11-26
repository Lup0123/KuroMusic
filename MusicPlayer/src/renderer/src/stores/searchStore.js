import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSearchStore = defineStore('search', () => {
  // 搜索关键词
  const searchKeyword = ref('')

  // 搜索结果
  const searchResults = ref({
    songs: [],
    trackCount: 0
  })

  // 当前激活的标签页
  const activeTab = ref('songs')

  // 是否已搜索
  const hasSearched = ref(false)

  // 是否正在加载
  const loading = ref(false)

  // 设置搜索关键词
  const setSearchKeyword = (keyword) => {
    searchKeyword.value = keyword
  }

  // 设置搜索结果 - 转换API返回格式
  const setSearchResults = (results) => {
    // 转换歌曲数据格式
    const songs = (results.songs || []).map((song) => ({
      id: song.id,
      name: song.name,
      alias: song.alia?.join(' / ') || '', // 副标题
      artist: song.ar?.map((a) => a.name).join(' / ') || '', // 艺术家
      album: song.al?.name || '', // 专辑
      albumId: song.al?.id,
      albumCover: song.al?.picUrl || '', // 专辑封面
      duration: formatDuration(song.dt), // 时长格式化
      durationMs: song.dt, // 原始时长(毫秒)
      fee: song.fee , // 付费类型
      mvId: song.mv, // MV ID
      privilege: song.privilege, // 权限信息
      // 音质信息
      quality: {
        h: song.h, // 高音质
        m: song.m, // 中音质
        l: song.l, // 低音质
        sq: song.sq, // 无损
        hr: song.hr // Hi-Res
      }
    }))

    searchResults.value = {
      songs,
      trackCount: results.songCount || songs.length
    }
  }

  // 格式化时长
  const formatDuration = (ms) => {
    if (!ms) return '00:00'
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // 设置激活标签
  const setActiveTab = (tab) => {
    activeTab.value = tab
  }

  // 设置是否已搜索
  const setHasSearched = (value) => {
    hasSearched.value = value
  }

  // 设置加载状态
  const setLoading = (value) => {
    loading.value = value
  }

  // 清空搜索
  const clearSearch = () => {
    searchKeyword.value = ''
    searchResults.value = {
      songs: [],
      trackCount: 0
    }
    activeTab.value = 'songs'
    hasSearched.value = false
    loading.value = false
  }

  return {
    searchKeyword,
    searchResults,
    activeTab,
    hasSearched,
    loading,
    setSearchKeyword,
    setSearchResults,
    setActiveTab,
    setHasSearched,
    setLoading,
    clearSearch
  }
})
