import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSearchStore = defineStore('search', () => {
  // 搜索关键词
  const searchKeyword = ref('')

  // 搜索结果
  const searchResults = ref({
    songs: [],
    artists: [],
    albums: [],
    playlists: []
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

  // 设置搜索结果
  const setSearchResults = (results) => {
    searchResults.value = results
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
      artists: [],
      albums: [],
      playlists: []
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
