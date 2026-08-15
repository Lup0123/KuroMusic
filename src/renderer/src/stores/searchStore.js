import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePlaylistStore } from './playlistStore'

export const useSearchStore = defineStore('search', () => {
  const createEmptySearchResults = () => ({
    songs: [],
    trackCount: 0,
    artists: [],
    artistCount: 0,
    playlists: [],
    playlistCount: 0
  })

  // 搜索关键词
  const searchKeyword = ref('')

  // 搜索结果
  const searchResults = ref(createEmptySearchResults())

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
  const setSearchResults = (results, tab = 'songs') => {
    const playlistStore = usePlaylistStore()

    const songs = (results.songs || []).map((song) => ({
      id: song.id,
      name: song.name,
      alias: song.alia?.join(' / ') || '',
      artist: song.ar?.map((a) => a.name).join(' / ') || '',
      album: song.al?.name || '',
      albumId: song.al?.id,
      albumCover: song.al?.picUrl || '',
      duration: formatDuration(song.dt),
      durationMs: song.dt,
      fee: song.fee,
      mvId: song.mv,
      privilege: song.privilege,
      liked: playlistStore.isSongLiked(song.id),
      quality: {
        h: song.h,
        m: song.m,
        l: song.l,
        sq: song.sq,
        hr: song.hr
      }
    }))

    const artists = (results.artists || []).map((artist) => ({
      id: artist.id,
      name: artist.name || '未知歌手',
      alias: artist.alias?.join(' / ') || '',
      picUrl: artist.picUrl || artist.img1v1Url || '',
      accountId: artist.accountId,
      albumSize: artist.albumSize || 0,
      musicSize: artist.musicSize || 0,
      fanCount: artist.fansCount || artist.fanCount || 0,
      briefDesc: artist.briefDesc || ''
    }))

    const playlists = (results.playlists || []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name || '未命名歌单',
      coverImgUrl: playlist.coverImgUrl || '',
      playCount: playlist.playCount || 0,
      trackCount: playlist.trackCount || 0,
      bookCount: playlist.bookCount || 0,
      creatorName: playlist.creator?.nickname || '',
      description: playlist.description || ''
    }))

    const nextResults = {
      ...searchResults.value
    }

    if (tab === 'songs') {
      nextResults.songs = songs
      nextResults.trackCount = results.songCount || songs.length
    }

    if (tab === 'artists') {
      nextResults.artists = artists
      nextResults.artistCount = results.artistCount || artists.length
    }

    if (tab === 'playlists') {
      nextResults.playlists = playlists
      nextResults.playlistCount = results.playlistCount || playlists.length
    }

    searchResults.value = nextResults
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
    searchResults.value = createEmptySearchResults()
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
