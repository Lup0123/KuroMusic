<template>
  <div class="song-search-container">
    <!-- 搜索结果头部 -->
    <div v-if="hasSearched && !loading" class="search-result-header">
      <div class="header-content">
        <div class="search-info">
          <h1 class="search-keyword">{{ searchKeyword }}</h1>
          <p class="search-stats">
            找到 <span class="count">{{ totalCount }}</span> 首相关歌曲
          </p>
        </div>

        <!-- 操作按钮 -->
        <div v-if="activeTab === 'songs' && currentResults.length > 0" class="header-actions">
          <a-button type="primary" size="large" @click="playAll">
            <template #icon>
              <icon-play-arrow-fill />
            </template>
            播放全部
          </a-button>
          <a-button size="large" @click="collectAll">
            <template #icon>
              <icon-folder-add />
            </template>
            收藏全部
          </a-button>
        </div>
      </div>
    </div>

    <!-- 搜索标签栏 -->
    <div v-if="hasSearched" class="search-tabs-wrapper">
      <div class="tabs-container">
        <div class="tab-list">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="handleTabChange(tab.key)"
          >
            <component :is="tab.icon" class="tab-icon" />
            <span class="tab-title">{{ tab.title }}</span>
            <span v-if="getTabCount(tab.key)" class="tab-count">
              {{ getTabCount(tab.key) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果内容 -->
    <div v-if="hasSearched" class="search-content">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-container">
        <a-spin :size="50" />
        <p class="loading-text">搜索中...</p>
      </div>

      <!-- 无结果 -->
      <a-empty
        v-else-if="!loading && currentResults.length === 0"
        description="暂无搜索结果"
        class="empty-result"
      />

      <!-- 单曲列表 -->
      <div v-else-if="activeTab === 'songs'" class="songs-result-container">
        <!-- 列表头部 -->
        <div class="list-header">
          <div class="header-col col-index">#</div>
          <div class="header-col col-title">标题</div>
          <div class="header-col col-album">专辑</div>
          <div class="header-col col-actions">喜欢</div>
          <div class="header-col col-duration">时长</div>
        </div>

        <!-- 歌曲列表 -->
        <div class="songs-list">
          <div
            v-for="(song, index) in paginatedResults"
            :key="song.id"
            class="song-row"
            :class="{
              active: currentSong?.id === song.id,
              playing: currentSong?.id === song.id && isPlaying
            }"
            @dblclick="playSong(song)"
          >
            <!-- 序号/播放按钮 -->
            <div class="col-index">
              <span class="row-number">{{ indexMethod(index) }}</span>
              <div class="play-overlay">
                <a-button type="text" class="play-btn" size="small" @click.stop="playSong(song)">
                  <template #icon>
                    <icon-play-arrow-fill v-if="currentSong?.id !== song.id || !isPlaying" />
                    <icon-pause v-else />
                  </template>
                </a-button>
              </div>
            </div>

            <!-- 歌曲信息 -->
            <div class="col-title">
              <div class="song-cover">
                <a-image :src="song.albumCover" fit="cover" :width="48" :height="48">
                  <template #error>
                    <div class="cover-placeholder">
                      <icon-music />
                    </div>
                  </template>
                </a-image>
                <div v-if="currentSong?.id === song.id && isPlaying" class="cover-play-icon">
                  <icon-sound-fill />
                </div>
              </div>
              <div class="song-info">
                <div class="song-name-wrapper">
                  <span class="song-name" :title="song.name">{{ song.name }}</span>
                  <div class="song-tags">
                    <a-tag v-if="song.fee === 1 || song.fee === 4" color="red" size="mini"
                      >VIP</a-tag
                    >
                    <a-tag v-if="song.mvId" color="arcoblue" size="mini">MV</a-tag>
                  </div>
                </div>
                <div
                  class="song-artist"
                  :title="song.artist + (song.alias ? ' - ' + song.alias : '')"
                >
                  {{ song.artist }}
                  <span v-if="song.alias" class="song-alias">{{ song.alias }}</span>
                </div>
              </div>
            </div>

            <!-- 专辑 -->
            <div class="col-album" :title="song.album">
              {{ song.album }}
            </div>

            <!-- 喜欢按钮 -->
            <div class="col-actions">
              <a-button
                type="text"
                size="small"
                class="action-btn add-btn"
                @click.stop="addSongToPlaylist(song)"
              >
                <template #icon>
                  <icon-folder-add />
                </template>
              </a-button>
              <a-button
                type="text"
                size="small"
                class="action-btn like-btn"
                @click.stop="toggleLike(song)"
              >
                <template #icon>
                  <icon-heart-fill v-if="song.liked" class="liked-icon" />
                  <icon-heart v-else />
                </template>
              </a-button>
            </div>

            <!-- 时长 -->
            <div class="col-duration">
              {{ song.duration }}
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <a-pagination
            v-model:current="currentPage"
            v-model:page-size="pageSize"
            :total="currentResults.length"
            :page-size-options="[30, 50, 100]"
            show-total
            show-jumper
            show-page-size
            @change="handleCurrentChange"
            @page-size-change="handleSizeChange"
          />
        </div>
      </div>

      <!-- 其他标签页 -->
      <div v-else class="other-tab-content">
        <a-empty description="该功能开发中..." />
      </div>
    </div>

    <!-- 未搜索提示 -->
    <div v-else class="welcome-state">
      <div class="welcome-content">
        <icon-search class="welcome-icon" />
        <h2>探索音乐世界</h2>
        <p>在顶部搜索栏输入关键词，开始你的音乐之旅</p>
      </div>
    </div>

    <!-- 添加到歌单弹窗 -->
    <a-modal
      v-model:visible="addToPlaylistModalVisible"
      title="添加到歌单"
      @ok="handleAddToPlaylist"
      @cancel="handleCancelAddToPlaylist"
    >
      <div class="playlist-selection">
        <div class="create-new-playlist" @click="handleCreateNewPlaylist">
          <icon-plus-circle :size="20" />
          <span>创建新歌单</span>
        </div>
        <a-divider />
        <div class="playlist-list">
          <div
            v-for="playlist in createdPlaylists"
            :key="playlist.id"
            class="playlist-option"
            :class="{ selected: selectedPlaylistId === playlist.id }"
            @click="selectPlaylist(playlist.id)"
          >
            <div class="playlist-cover">
              <a-image :src="getPlaylistCover(playlist)" :width="40" :height="40" fit="cover" />
            </div>
            <div class="playlist-info">
              <div class="playlist-name">{{ playlist.name }}</div>
              <div class="playlist-count">{{ playlist.songs?.length || 0 }} 首歌曲</div>
            </div>
            <icon-check-circle-fill v-if="selectedPlaylistId === playlist.id" class="check-icon" />
          </div>
        </div>
        <a-empty v-if="createdPlaylists.length === 0" description="暂无歌单，请先创建" />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, toRaw } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconSearch,
  IconPlayArrowFill,
  IconPause,
  IconFolderAdd,
  IconHeart,
  IconHeartFill,
  IconMusic,
  IconSoundFill,
  IconUser,
  IconFolder,
  IconFile,
  IconVoice,
  IconPlusCircle,
  IconCheckCircleFill
} from '@arco-design/web-vue/es/icon'
import { useSearchStore } from '@/stores/searchStore'
import { useSongStore } from '@/stores/songStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { storeToRefs } from 'pinia'

const searchStore = useSearchStore()
const { searchKeyword, searchResults, activeTab, hasSearched, loading } = storeToRefs(searchStore)

const { setSearchResults, setActiveTab, setHasSearched, setLoading } = searchStore

const songStore = useSongStore()
const { currentSong, isPlaying } = storeToRefs(songStore)
const { play } = songStore

const playlistStore = usePlaylistStore()
const { createdPlaylists } = storeToRefs(playlistStore)

// 添加到歌单相关
const addToPlaylistModalVisible = ref(false)
const selectedPlaylistId = ref(null)
const currentSongToAdd = ref(null)
const isCollectAll = ref(false) // 标记是否为收藏全部

// 标签页配置
const tabs = [
  { key: 'songs', title: '单曲', icon: IconMusic },
  { key: 'artists', title: '歌手', icon: IconUser },
  { key: 'albums', title: '专辑', icon: IconFolder },
  { key: 'playlists', title: '歌单', icon: IconFolder },
  { key: 'mv', title: 'MV', icon: IconVoice },
  { key: 'lyrics', title: '歌词', icon: IconFile },
  { key: 'voice', title: '声音', icon: IconVoice }
]

// 分页相关
const currentPage = ref(1)
const pageSize = ref(30)

// 执行搜索
const performSearch = async (keyword) => {
  if (!keyword || !keyword.trim()) {
    return
  }

  setLoading(true)
  setHasSearched(true)

  try {
    const response = await window.api.search(keyword.trim(), 1)
    console.log('搜索结果:', response)
    const results = response.body.result
    if (results && response) {
      setSearchResults(results)
      Message.success(`找到 ${results.songCount || 0} 首相关歌曲`)
    } else {
      Message.error('搜索失败，请重试')
      setSearchResults({ songs: [], songCount: 0 })
    }
  } catch (error) {
    console.error('搜索错误:', error)
    Message.error('搜索出错，请稍后重试')
    setSearchResults({ songs: [], songCount: 0 })
  } finally {
    setLoading(false)
  }
}

// 监听搜索关键词变化
watch(
  searchKeyword,
  (newKeyword) => {
    if (newKeyword && newKeyword.trim()) {
      performSearch(newKeyword)
      currentPage.value = 1
    }
  },
  { immediate: false }
)

// 组件挂载时检查是否有搜索关键词
onMounted(() => {
  if (searchKeyword.value && searchKeyword.value.trim()) {
    performSearch(searchKeyword.value)
  }
})

const totalCount = computed(() => {
  return searchResults.value.trackCount || searchResults.value.songs?.length || 0
})

const currentResults = computed(() => {
  if (activeTab.value === 'songs') {
    return searchResults.value.songs || []
  }
  return searchResults.value[activeTab.value] || []
})

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return currentResults.value.slice(start, end)
})

const indexMethod = (index) => {
  return String((currentPage.value - 1) * pageSize.value + index + 1).padStart(2, '0')
}

const getTabCount = (tabKey) => {
  if (tabKey === 'songs') {
    return searchResults.value.trackCount || searchResults.value.songs?.length || 0
  }
  const results = searchResults.value[tabKey]
  return results?.length || 0
}

watch(activeTab, () => {
  currentPage.value = 1
})

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  const container = document.querySelector('.search-content')
  if (container) {
    container.scrollTop = 0
  }
}

const handleTabChange = (tab) => {
  setActiveTab(tab)
}

const playSong = async (song) => {
  try {
    // 从设置中获取音质
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
    const settingQuality = settings.quality || 'exhigh'
    // 映射音质设置到 API 支持的格式
    const qualityMap = {
      standard: 'standard', // 标准品质 128kbps
      higher: 'higher', // 较高品质 192kbps
      exhigh: 'exhigh', // 极高品质 320kbps
      lossless: 'lossless', // 无损品质 FLAC
      hires: 'hires' // Hi-Res 高解析度
    }
    const quality = qualityMap[settingQuality] || 'exhigh'

    const response = await window.api.getSongUrl(song.id, quality)
    const result = response.body

    if (result.code == 200) {
      const fullSong = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.albumCover || 'https://via.placeholder.com/50',
        duration: song.duration,
        dt: song.durationMs
      }
      play(fullSong)
      Message.success(`开始播放: ${song.name}`)
    } else {
      Message.error('无法获取播放链接')
    }
  } catch (error) {
    Message.error('获取播放链接失败')
    console.error('播放错误:', error)
  }
}

const toggleLike = async (song) => {
  const newLikedState = !song.liked

  try {
    const success = await playlistStore.toggleLikeSong(song.id, newLikedState)
    if (success) {
      song.liked = newLikedState
      Message.success(newLikedState ? '已添加到我喜欢的音乐' : '已取消喜欢')
    } else {
      Message.error('操作失败，请重试')
    }
  } catch (error) {
    console.error('喜欢操作失败:', error)
    Message.error('操作失败: ' + error.message)
  }
}

const playAll = async () => {
  if (currentResults.value.length > 0) {
    const firstSong = currentResults.value[0]
    await playSong(firstSong)
    Message.success(`开始播放全部 ${currentResults.value.length} 首歌曲`)
  }
}

const collectAll = () => {
  isCollectAll.value = true
  currentSongToAdd.value = null
  selectedPlaylistId.value = null
  addToPlaylistModalVisible.value = true
}

// 添加单曲到歌单
const addSongToPlaylist = (song) => {
  isCollectAll.value = false
  currentSongToAdd.value = {
    id: song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    cover: song.albumCover || 'https://via.placeholder.com/50',
    duration: song.duration,
    dt: song.durationMs
  }
  selectedPlaylistId.value = null
  addToPlaylistModalVisible.value = true
}

const selectPlaylist = (playlistId) => {
  selectedPlaylistId.value = playlistId
}

const handleAddToPlaylist = async () => {
  if (!selectedPlaylistId.value) {
    Message.warning('请选择一个歌单')
    return false
  }

  try {
    if (isCollectAll.value) {
      // 收藏全部歌曲
      let successCount = 0
      for (const song of currentResults.value) {
        const songData = {
          id: song.id,
          name: song.name,
          artist: song.artist,
          album: song.album,
          cover: song.albumCover || 'https://via.placeholder.com/50',
          duration: song.duration,
          dt: song.durationMs
        }
        const success = await playlistStore.addSongToLocalPlaylist(
          selectedPlaylistId.value,
          songData
        )
        if (success) successCount++
      }
      Message.success(`成功添加 ${successCount} 首歌曲到歌单`)
      await playlistStore.loadLocalPlaylists()
      isCollectAll.value = false
      selectedPlaylistId.value = null
      return true
    } else {
      // 添加单曲
      if (!currentSongToAdd.value) {
        Message.error('没有选择要添加的歌曲')
        return false
      }

      const success = await playlistStore.addSongToLocalPlaylist(
        selectedPlaylistId.value,
        toRaw(currentSongToAdd.value)
      )

      if (success) {
        Message.success('添加成功')
        await playlistStore.loadLocalPlaylists()
        currentSongToAdd.value = null
        selectedPlaylistId.value = null
        return true
      } else {
        Message.warning('歌曲已存在于该歌单中')
        return false
      }
    }
  } catch (error) {
    console.error('添加歌曲到歌单失败:', error)
    Message.error('添加失败: ' + error.message)
    return false
  }
}

const handleCancelAddToPlaylist = () => {
  addToPlaylistModalVisible.value = false
  currentSongToAdd.value = null
  selectedPlaylistId.value = null
  isCollectAll.value = false
}

// 获取歌单封面（本地歌单使用第一首歌的封面）
const getPlaylistCover = (playlist) => {
  if (playlist.cover) {
    return playlist.cover
  }
  // 本地歌单：尝试使用第一首歌的封面
  if (playlist.songs && playlist.songs.length > 0) {
    const firstSong = playlist.songs[0]
    return firstSong.al?.picUrl || firstSong.cover || 'https://via.placeholder.com/40'
  }
  return 'https://via.placeholder.com/40'
}

const handleCreateNewPlaylist = () => {
  addToPlaylistModalVisible.value = false
  Message.info('请在侧边栏创建新歌单')
}
</script>

<style scoped lang="scss">
@import './songsearch.scss';
</style>
