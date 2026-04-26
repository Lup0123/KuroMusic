<template>
  <div class="song-search-container">
    <!-- 搜索结果头部 -->
    <div
      v-if="hasSearched && !loading"
      class="search-result-header"
      :class="{ hidden: isScrolled }"
    >
      <div class="header-content">
        <div class="search-info">
          <h1 class="search-keyword">{{ searchKeyword }}</h1>
          <p class="search-stats">
            找到 <span class="count">{{ totalCount }}</span> {{ resultLabel }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <div v-if="activeTab === 'songs' && currentResults.length > 0" class="header-actions">
          <n-button type="primary" @click="playAll">
            <template #icon>
              <n-icon><PlaySharp /></n-icon>
            </template>
            播放全部
          </n-button>
          <n-button @click="collectAll">
            <template #icon>
              <n-icon><FolderOpenOutline /></n-icon>
            </template>
            收藏全部
          </n-button>
        </div>
      </div>
    </div>

    <!-- 搜索标签栏 -->
    <div v-if="hasSearched" class="search-tabs-wrapper" :class="{ hidden: isScrolled }">
      <div class="tabs-container">
        <div class="tab-list">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="handleTabChange(tab.key)"
          >
            <n-icon :component="tab.icon" class="tab-icon" />
            <span class="tab-title">{{ tab.title }}</span>
            <span v-if="getTabCount(tab.key)" class="tab-count">
              {{ getTabCount(tab.key) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果内容 -->
    <div
      v-if="hasSearched"
      ref="searchContentRef"
      class="search-content"
      @scroll="handleContentScroll"
    >
      <StateView
        :loading="loading"
        :empty="!loading && isSupportedTab && currentResults.length === 0"
        loading-text="搜索中..."
        empty-text="暂无搜索结果"
      >
        <!-- 单曲列表 -->
        <div v-if="activeTab === 'songs'" class="songs-result-container">
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
              v-for="(song, index) in currentResults"
              :key="song.id"
              class="song-row"
              :class="{
                active: currentSong?.id === song.id,
                playing: currentSong?.id === song.id && isPlaying
              }"
              @dblclick="playSong(song)"
            >
              <!-- 搴忓彿/鎾斁鎸夐挳 -->
              <div class="col-index">
                <span class="row-number">{{ indexMethod(index) }}</span>
                <div class="play-overlay">
                  <n-button text class="play-btn" size="small" @click.stop="playSong(song)">
                    <template #icon>
                      <n-icon size="22">
                        <PlaySharp v-if="currentSong?.id !== song.id || !isPlaying" />
                        <PauseSharp v-else />
                      </n-icon>
                    </template>
                  </n-button>
                </div>
              </div>

              <!-- 歌曲信息 -->
              <div class="col-title">
                <div class="song-cover">
                  <AppCover :src="song.albumCover" :width="40" :height="40" :size="80">
                    <template #fallback>
                      <div class="cover-placeholder">
                        <n-icon><MusicalNotesOutline /></n-icon>
                      </div>
                    </template>
                  </AppCover>
                  <div v-if="currentSong?.id === song.id && isPlaying" class="cover-play-icon">
                    <n-icon><VolumeHighOutline /></n-icon>
                  </div>
                </div>
                <div class="song-info">
                  <div class="song-name-wrapper">
                    <span class="song-name" :title="song.name">{{ song.name }}</span>
                    <div class="song-tags">
                      <n-tag v-if="song.fee === 1 || song.fee === 4" type="error" size="small"
                        >VIP</n-tag
                      >
                      <n-tag v-if="song.mvId" type="info" size="small">MV</n-tag>
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
                <n-button
                  text
                  size="small"
                  class="action-btn add-btn"
                  @click.stop="addSongToPlaylist(song)"
                >
                  <template #icon>
                    <n-icon size="20"><FolderOpenOutline /></n-icon>
                  </template>
                </n-button>
                <n-button
                  text
                  size="small"
                  class="action-btn like-btn"
                  @click.stop="toggleLike(song)"
                >
                  <template #icon>
                    <n-icon size="20">
                      <Heart v-if="song.liked" class="liked-icon" />
                      <HeartOutline v-else />
                    </n-icon>
                  </template>
                </n-button>
              </div>

              <!-- 时长 -->
              <div class="col-duration">
                {{ song.duration }}
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div class="pagination-wrapper">
            <n-pagination
              v-model:page="currentPage"
              :page-size="pageSize"
              :item-count="totalCount"
              show-quick-jumper
              @update:page="handleCurrentChange"
            />
          </div>
        </div>

        <!-- 歌手列表 -->
        <div v-else-if="activeTab === 'artists'" class="artists-result-container">
          <div class="artists-list">
            <div
              v-for="artist in currentResults"
              :key="artist.id"
              class="artist-card"
              title="点击查看歌手详情"
              @click="handleArtistCardClick(artist)"
            >
              <div class="artist-avatar">
                <AppCover :src="artist.picUrl" :width="72" :height="72" :size="144" :radius="999">
                  <template #fallback>
                    <div class="avatar-placeholder">
                      <n-icon><PersonOutline /></n-icon>
                    </div>
                  </template>
                </AppCover>
              </div>
              <div class="artist-main">
                <div class="artist-name" :title="artist.name">
                  {{ artist.name || '未知歌手' }}
                </div>
                <div v-if="artist.alias" class="artist-alias" :title="artist.alias">
                  {{ artist.alias }}
                </div>
                <div class="artist-meta">
                  <span>粉丝 {{ formatCount(artist.fanCount) }}</span>
                  <span>单曲 {{ artist.musicSize || 0 }}</span>
                  <span>专辑 {{ artist.albumSize || 0 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 歌单列表 -->
        <div v-else-if="activeTab === 'playlists'" class="playlists-result-container">
          <div class="playlists-list">
            <div
              v-for="playlist in currentResults"
              :key="playlist.id"
              class="playlist-card"
              @click="handlePlaylistCardClick(playlist)"
            >
              <div class="playlist-cover">
                <AppCover :src="playlist.coverImgUrl" :width="88" :height="88" :size="176">
                  <template #fallback>
                    <div class="playlist-placeholder">
                      <n-icon><FolderOutline /></n-icon>
                    </div>
                  </template>
                </AppCover>
              </div>
              <div class="playlist-main">
                <div class="playlist-name" :title="playlist.name">
                  {{ playlist.name || '未命名歌单' }}
                </div>
                <div class="playlist-meta">
                  <span>播放 {{ formatCount(playlist.playCount) }}</span>
                  <span>曲目 {{ playlist.trackCount || 0 }}</span>
                  <span v-if="playlist.creatorName">创建者 {{ playlist.creatorName }}</span>
                </div>
                <div
                  v-if="playlist.description"
                  class="playlist-desc"
                  :title="playlist.description"
                >
                  {{ playlist.description }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 其他标签页 -->
        <div v-else class="other-tab-content">
          <n-empty description="该功能开发中..." />
        </div>
      </StateView>
    </div>

    <!-- 未搜索提示 -->
    <div v-else class="welcome-state">
      <div class="welcome-content">
        <n-icon size="120" class="welcome-icon"><SearchOutline /></n-icon>
        <h2>探索音乐世界</h2>
        <p>在顶部搜索栏输入关键词，开始你的音乐之旅</p>
      </div>
    </div>

    <!-- 添加到歌单弹窗 -->
    <n-modal
      v-model:show="addToPlaylistModalVisible"
      preset="dialog"
      title="添加到歌单"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleAddToPlaylist"
      @negative-click="handleCancelAddToPlaylist"
    >
      <div class="playlist-selection">
        <div class="create-new-playlist" @click="handleCreateNewPlaylist">
          <n-icon size="20"><AddCircleOutline /></n-icon>
          <span>创建新歌单</span>
        </div>
        <n-divider />
        <div class="playlist-list">
          <div
            v-for="playlist in createdPlaylists"
            :key="playlist.id"
            class="playlist-option"
            :class="{ selected: selectedPlaylistId === playlist.id }"
            @click="selectPlaylist(playlist.id)"
          >
            <div class="playlist-cover">
              <n-image
                :src="getPlaylistCover(playlist)"
                :width="40"
                :height="40"
                preview-disabled
              />
            </div>
            <div class="playlist-info">
              <div class="playlist-name">{{ playlist.name }}</div>
              <div class="playlist-count">{{ playlist.songs?.length || 0 }} 首歌曲</div>
            </div>
            <n-icon v-if="selectedPlaylistId === playlist.id" class="check-icon" size="20">
              <CheckmarkCircle />
            </n-icon>
          </div>
        </div>
        <n-empty v-if="createdPlaylists.length === 0" description="暂无歌单，请先创建" />
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import {
  SearchOutline,
  PlaySharp,
  PauseSharp,
  FolderOpenOutline,
  HeartOutline,
  Heart,
  MusicalNotesOutline,
  VolumeHighOutline,
  PersonOutline,
  FolderOutline,
  DocumentTextOutline,
  MicOutline,
  AddCircleOutline,
  CheckmarkCircle
} from '@vicons/ionicons5'
import { useSearchStore } from '@/stores/searchStore'
import { useSongStore } from '@/stores/songStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { ROUTE_NAMES } from '@/router/routeNames'
import AppCover from '@/components/common/AppCover.vue'
import StateView from '@/components/common/StateView.vue'
import { useAppFeedback } from '@/composables/useAppFeedback'
import { storeToRefs } from 'pinia'

const feedback = useAppFeedback()
const router = useRouter()

const searchStore = useSearchStore()
const { searchKeyword, searchResults, activeTab, hasSearched, loading } = storeToRefs(searchStore)

const { setSearchResults, setActiveTab, setHasSearched, setLoading } = searchStore

const songStore = useSongStore()
const { currentSong, isPlaying } = storeToRefs(songStore)
const { play } = songStore

const playlistStore = usePlaylistStore()
const { createdPlaylists } = storeToRefs(playlistStore)
const { setCurrentPlaylist } = playlistStore

// 添加到歌单相关
const addToPlaylistModalVisible = ref(false)
const selectedPlaylistId = ref(null)
const currentSongToAdd = ref(null)
const isCollectAll = ref(false)
const searchContentRef = ref(null)
const isScrolled = ref(false)

// 标签页配置
const tabs = [
  { key: 'songs', title: '单曲', icon: MusicalNotesOutline },
  { key: 'artists', title: '歌手', icon: PersonOutline },
  { key: 'albums', title: '专辑', icon: FolderOutline },
  { key: 'playlists', title: '歌单', icon: FolderOutline },
  { key: 'mv', title: 'MV', icon: MicOutline },
  { key: 'lyrics', title: '歌词', icon: DocumentTextOutline },
  { key: 'voice', title: '声音', icon: MicOutline }
]

// 分页相关
const currentPage = ref(1)
const pageSize = 50

const tabTypeMap = {
  songs: 1,
  artists: 100,
  playlists: 1000
}

const handleContentScroll = (event) => {
  const scrollTop = event.target.scrollTop
  isScrolled.value = scrollTop > 220
}

// 执行搜索
const performSearch = async (keyword, page = 1, targetTab = activeTab.value) => {
  if (!keyword || !keyword.trim()) {
    return
  }

  const tabType = tabTypeMap[targetTab]
  if (!tabType) {
    return
  }

  setLoading(true)
  setHasSearched(true)

  try {
    const offset = (page - 1) * pageSize
    const response = await window.api.search(keyword.trim(), tabType, pageSize, offset)
    console.log('搜索结果:', response)
    const results = response?.body?.result
    if (results && response) {
      setSearchResults(results, targetTab)
    } else {
      feedback.error('搜索失败，请重试')
      setSearchResults({}, targetTab)
    }
  } catch (error) {
    console.error('搜索错误:', error)
    feedback.error('搜索出错，请稍后重试')
    setSearchResults({}, targetTab)
  } finally {
    setLoading(false)
  }
}

// 监听搜索关键词变化
watch(
  searchKeyword,
  (newKeyword) => {
    if (newKeyword && newKeyword.trim()) {
      currentPage.value = 1
      performSearch(newKeyword, 1, activeTab.value)
    }
  },
  { immediate: false }
)

// 组件挂载时检查是否有搜索关键词
onMounted(() => {
  if (searchKeyword.value && searchKeyword.value.trim()) {
    performSearch(searchKeyword.value, currentPage.value, activeTab.value)
  }
})

const totalCount = computed(() => {
  if (activeTab.value === 'songs') {
    return searchResults.value.trackCount || searchResults.value.songs?.length || 0
  }
  if (activeTab.value === 'artists') {
    return searchResults.value.artistCount || searchResults.value.artists?.length || 0
  }
  if (activeTab.value === 'playlists') {
    return searchResults.value.playlistCount || searchResults.value.playlists?.length || 0
  }
  return 0
})

const resultLabel = computed(() => {
  if (activeTab.value === 'songs') return '首相关歌曲'
  if (activeTab.value === 'artists') return '位相关歌手'
  if (activeTab.value === 'playlists') return '个相关歌单'
  return '条相关结果'
})

const isSupportedTab = computed(() => Boolean(tabTypeMap[activeTab.value]))

const currentResults = computed(() => {
  if (activeTab.value === 'songs') return searchResults.value.songs || []
  if (activeTab.value === 'artists') return searchResults.value.artists || []
  if (activeTab.value === 'playlists') return searchResults.value.playlists || []
  return []
})

const indexMethod = (index) => {
  return String((currentPage.value - 1) * pageSize + index + 1).padStart(2, '0')
}

const getTabCount = (tabKey) => {
  if (tabKey === 'songs') {
    return searchResults.value.trackCount || searchResults.value.songs?.length || 0
  }
  if (tabKey === 'artists') {
    return searchResults.value.artistCount || searchResults.value.artists?.length || 0
  }
  if (tabKey === 'playlists') {
    return searchResults.value.playlistCount || searchResults.value.playlists?.length || 0
  }
  return 0
}

watch(activeTab, (newTab) => {
  currentPage.value = 1
  if (searchContentRef.value) {
    searchContentRef.value.scrollTop = 0
  }
  isScrolled.value = false

  if (!searchKeyword.value || !searchKeyword.value.trim()) {
    return
  }

  if (tabTypeMap[newTab]) {
    performSearch(searchKeyword.value, 1, newTab)
  }
})

const handleCurrentChange = (val) => {
  currentPage.value = val
  performSearch(searchKeyword.value, currentPage.value, activeTab.value)
  if (searchContentRef.value) {
    searchContentRef.value.scrollTop = 0
  }
  isScrolled.value = false
}

const handleTabChange = (tab) => {
  setActiveTab(tab)
}

const handleArtistCardClick = async (artist) => {
  if (!artist?.id) return

  router.push({
    name: ROUTE_NAMES.ARTIST_DETAIL,
    params: { id: String(artist.id) },
    query: {
      name: artist.name || '',
      alias: artist.alias || '',
      avatar: artist.picUrl || '',
      fanCount: String(artist.fanCount || 0),
      musicSize: String(artist.musicSize || 0),
      albumSize: String(artist.albumSize || 0)
    }
  })
}

const handlePlaylistCardClick = (playlist) => {
  if (!playlist?.id) return

  setCurrentPlaylist({
    id: playlist.id,
    name: playlist.name || '未命名歌单',
    cover: playlist.coverImgUrl || '',
    description: playlist.description || '',
    createTime: playlist.createTime,
    isLocal: false
  })

  router.push({ name: ROUTE_NAMES.PLAYLIST_DETAIL, params: { id: String(playlist.id) } })
}

const formatCount = (value) => {
  const count = Number(value) || 0
  if (count >= 100000000) return `${(count / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `${count}`
}

const playSong = async (song) => {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
    const settingQuality = settings.quality || 'exhigh'
    const qualityMap = {
      standard: 'standard',
      higher: 'higher',
      exhigh: 'exhigh',
      lossless: 'lossless',
      hires: 'hires'
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
      feedback.success(`开始播放 ${song.name}`)
    } else {
      feedback.error('无法获取播放链接')
    }
  } catch (error) {
    feedback.error('获取播放链接失败')
    console.error('播放错误:', error)
  }
}

const toggleLike = async (song) => {
  const newLikedState = !song.liked

  try {
    const success = await playlistStore.toggleLikeSong(song.id, newLikedState)
    if (success) {
      song.liked = newLikedState
      feedback.success(newLikedState ? '已添加到我喜欢的音乐' : '已取消喜欢')
    } else {
      feedback.error('操作失败，请重试')
    }
  } catch (error) {
    console.error('喜欢操作失败:', error)
    feedback.errorWith(error, '操作失败，请重试')
  }
}

const playAll = async () => {
  if (currentResults.value.length > 0) {
    const firstSong = currentResults.value[0]
    await playSong(firstSong)
    feedback.success(`开始播放全部 ${currentResults.value.length} 首歌曲`)
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
    feedback.warning('请选择一个歌单')
    return false
  }

  try {
    if (isCollectAll.value) {
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
      feedback.success(`成功添加 ${successCount} 首歌曲到歌单`)
      await playlistStore.loadLocalPlaylists()
      isCollectAll.value = false
      selectedPlaylistId.value = null
      addToPlaylistModalVisible.value = false
      return true
    } else {
      if (!currentSongToAdd.value) {
        feedback.error('没有选择要添加的歌曲')
        return false
      }

      const success = await playlistStore.addSongToLocalPlaylist(
        selectedPlaylistId.value,
        toRaw(currentSongToAdd.value)
      )

      if (success) {
        feedback.success('添加成功')
        await playlistStore.loadLocalPlaylists()
        currentSongToAdd.value = null
        selectedPlaylistId.value = null
        addToPlaylistModalVisible.value = false
        return true
      } else {
        feedback.warning('歌曲已存在于该歌单中')
        return false
      }
    }
  } catch (error) {
    console.error('添加歌曲到歌单失败:', error)
    feedback.errorWith(error, '添加失败，请稍后重试')
    return false
  }
}

const handleCancelAddToPlaylist = () => {
  addToPlaylistModalVisible.value = false
  currentSongToAdd.value = null
  selectedPlaylistId.value = null
  isCollectAll.value = false
}

// 获取歌单封面
const getPlaylistCover = (playlist) => {
  if (playlist.cover) {
    return playlist.cover
  }
  if (playlist.songs && playlist.songs.length > 0) {
    const firstSong = playlist.songs[0]
    return (
      firstSong.al?.picUrl ||
      firstSong.cover ||
      firstSong.albumCover ||
      'https://via.placeholder.com/40'
    )
  }
  return 'https://via.placeholder.com/40'
}

const handleCreateNewPlaylist = () => {
  addToPlaylistModalVisible.value = false
  feedback.info('请在侧边栏创建新歌单')
}
</script>

<style scoped lang="scss">
.song-search-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--n-color);
  position: relative;
  padding: 0 0 12px;
}

// 搜索结果头部
.search-result-header {
  padding: 8px 24px 10px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--n-primary-color) 16%, transparent) 0%,
    var(--n-card-color) 50%,
    var(--n-color) 100%
  );
  border-bottom: 1px solid var(--n-border-color);
  position: relative;
  overflow: hidden;
  max-height: 160px;
  transition:
    max-height 0.28s ease,
    padding 0.28s ease,
    opacity 0.2s ease,
    border-color 0.2s ease;

  &.hidden {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    border-bottom-color: transparent;
    pointer-events: none;
  }

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 380px;
    height: 380px;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--n-primary-color) 24%, transparent) 0%,
      transparent 70%
    );
    opacity: 0.3;
    pointer-events: none;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    max-width: 1600px;
    margin: 0 auto;
    position: relative;
    z-index: 1;

    .search-info {
      flex: 1;

      .search-keyword {
        font-size: 28px;
        font-weight: 800;
        color: var(--n-text-color);
        margin: 0 0 4px 0;
        letter-spacing: -1px;
        background: linear-gradient(135deg, var(--n-text-color) 0%, var(--n-primary-color) 100%);
        background-clip: text;
      }

      .search-stats {
        font-size: 13px;
        color: var(--n-text-color-2);
        margin: 0;
        font-weight: 500;

        .count {
          color: var(--n-primary-color);
          font-weight: 700;
          font-size: 14px;
          padding: 0 6px;
          background: color-mix(in srgb, var(--n-primary-color) 16%, transparent);
          border-radius: 4px;
          margin: 0 4px;
        }
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;

      :deep(.n-button) {
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        font-weight: 500;

        &:hover {
          transform: translateY(-1px);
        }
      }
    }
  }
}

// 标签栏
.search-tabs-wrapper {
  background: var(--n-color);
  border-bottom: 1px solid var(--n-border-color);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  max-height: 80px;
  overflow: hidden;
  transition:
    max-height 0.24s ease,
    opacity 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &.hidden {
    max-height: 0;
    opacity: 0;
    border-bottom-color: transparent;
    box-shadow: none;
    pointer-events: none;
  }

  .tabs-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 24px;

    .tab-list {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      .tab-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        cursor: pointer;
        color: var(--n-text-color-2);
        border-bottom: 3px solid transparent;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        user-select: none;
        position: relative;
        border-radius: 8px 8px 0 0;

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 80%;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--n-primary-color) 50%,
            transparent 100%
          );
          border-radius: 2px;
          transition: transform 0.3s ease;
        }

        .tab-icon {
          font-size: 15px;
          transition: transform 0.3s ease;
        }

        .tab-title {
          font-size: 13px;
          font-weight: 500;
        }

        .tab-count {
          padding: 1px 8px;
          background: var(--n-hover-color);
          border-radius: 12px;
          font-size: 12px;
          color: var(--n-text-color-3);
          font-weight: 600;
          transition: all 0.3s ease;
        }

        &:hover {
          color: var(--n-text-color);
          background: var(--n-hover-color);

          .tab-icon {
            transform: scale(1.1);
          }

          .tab-title {
            color: var(--n-text-color);
          }
        }

        &.active {
          color: var(--n-primary-color);
          font-weight: 600;

          &::after {
            transform: translateX(-50%) scaleX(1);
          }

          .tab-count {
            background: color-mix(in srgb, var(--n-primary-color) 24%, transparent);
            color: var(--n-primary-color);
          }

          .tab-icon {
            transform: scale(1.15);
            color: var(--n-pressed-color);
          }

          .tab-title {
            color: var(--n-text-color);
          }
        }
      }
    }
  }
}

// 搜索内容
.search-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 24px 18px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;

  // 婊氬姩鏉℃牱寮?
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border-3);
    border-radius: 4px;
    transition: background 0.3s ease;

    &:hover {
      background: var(--color-border-4);
    }
  }
}

// 歌曲列表容器
.songs-result-container {
  .list-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    margin-bottom: 8px;
    color: var(--n-text-color-3);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--n-hover-color);
    border-radius: 8px;
    border: 1px solid var(--n-border-color);
    position: sticky;
    top: 0;
    z-index: 2;

    .header-col {
      &.col-index {
        width: 48px;
        text-align: center;
      }

      &.col-title {
        flex: 1;
        min-width: 0;
      }

      &.col-album {
        width: 220px;
        padding: 0 10px;
      }

      &.col-actions {
        width: 92px;
        text-align: center;
      }

      &.col-duration {
        width: 72px;
        text-align: right;
      }
    }
  }

  .songs-list {
    .song-row {
      display: flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      margin-bottom: 2px;
      border: 1px solid transparent;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 8px;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--n-primary-color) 16%, transparent) 0%,
          transparent 100%
        );
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      &:hover {
        background: var(--n-hover-color);
        border-color: var(--n-border-color);
        transform: translateX(2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

        &::before {
          opacity: 0.5;
        }

        .play-overlay {
          opacity: 1;
        }

        .row-number {
          opacity: 0;
        }
      }

      &.active {
        background: color-mix(in srgb, var(--n-primary-color) 16%, transparent);
        border-color: var(--n-primary-color);

        .song-name {
          color: var(--n-primary-color);
          font-weight: 600;
        }
      }

      &.playing {
        .song-cover {
          border: 2px solid var(--n-primary-color);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--n-primary-color) 24%, transparent);
        }
      }

      .col-index {
        width: 48px;
        text-align: center;
        position: relative;

        .row-number {
          font-size: 13px;
          color: var(--n-text-color-3);
          font-weight: 600;
          transition: opacity 0.2s;
        }

        .play-overlay {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 0.2s;

          .play-btn {
            color: var(--n-primary-color);
            font-size: 22px;
            transition: all 0.2s;

            &:hover {
              transform: scale(1.2);
            }
          }
        }
      }

      .col-title {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;

        .song-cover {
          position: relative;
          flex-shrink: 0;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

          &:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          }

          .cover-placeholder {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
              135deg,
              var(--n-hover-color) 0%,
              var(--n-pressed-color) 100%
            );
            color: var(--n-text-color-disabled);
          }

          .cover-play-icon {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(2px);
            color: var(--n-primary-color);
            font-size: 18px;
            animation: pulse 1.5s infinite;
          }
        }

        .song-info {
          flex: 1;
          min-width: 0;

          .song-name-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 2px;

            .song-name {
              font-size: 13px;
              font-weight: 500;
              color: var(--n-text-color);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
              transition: color 0.3s ease;
            }

            .song-tags {
              display: flex;
              gap: 6px;
              flex-shrink: 0;

              :deep(.n-tag) {
                font-weight: 600;
                border-radius: 4px;
              }
            }
          }

          .song-artist {
            font-size: 12px;
            color: var(--n-text-color-3);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            .song-alias {
              margin-left: 6px;
              opacity: 0.7;
              font-style: italic;
            }
          }
        }
      }

      .col-album {
        width: 220px;
        padding: 0 10px;
        font-size: 12px;
        color: var(--n-text-color-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color 0.3s ease;

        &:hover {
          color: var(--n-text-color);
        }
      }

      .col-actions {
        width: 92px;
        text-align: center;

        .action-btn {
          opacity: 0;
          transition: all 0.2s;
          font-size: 20px;

          &:hover {
            transform: scale(1.2);
          }
        }

        .liked-icon {
          color: #f53f3f;
        }
      }

      &:hover .col-actions .action-btn {
        opacity: 1;
      }

      .col-actions .liked-icon {
        opacity: 1;
      }

      .col-duration {
        width: 72px;
        text-align: right;
        font-size: 12px;
        color: var(--n-text-color-3);
        font-variant-numeric: tabular-nums;
        font-weight: 500;
      }
    }
  }
}

.artists-result-container,
.playlists-result-container {
  .artists-list,
  .playlists-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }
}

.artist-card,
.playlist-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  background: var(--n-card-color);
  transition: all 0.25s ease;

  &:hover {
    background: color-mix(in srgb, var(--n-primary-color) 8%, var(--n-card-color));
    border-color: color-mix(in srgb, var(--n-primary-color) 32%, var(--n-border-color));
    transform: translateY(-1px);
  }
}

.artist-avatar,
.playlist-cover {
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;

  .avatar-placeholder,
  .playlist-placeholder {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--n-hover-color);
    color: var(--n-text-color-3);
    font-size: 24px;
  }

  .playlist-placeholder {
    width: 88px;
    height: 88px;
  }
}

.artist-main,
.playlist-main {
  flex: 1;
  min-width: 0;
}

.artist-name,
.playlist-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-alias,
.playlist-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-meta,
.playlist-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    font-size: 12px;
    color: var(--n-text-color-2);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--n-hover-color);
  }
}

// 分页
.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
  overflow-x: auto;
  margin-bottom: 50px;

  :deep(.n-pagination) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 6px;
    row-gap: 8px;
    max-width: 100%;

    .n-pagination-item {
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
      }
    }
  }
}

// 加载中
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;

  .loading-text {
    margin-top: 24px;
    color: var(--n-text-color-2);
    font-size: 16px;
    font-weight: 500;
  }
}

// 空状态
.empty-result {
  padding: 120px 0;

  :deep(.n-empty__description) {
    font-size: 16px;
    color: var(--n-text-color-2);
    margin-top: 20px;
  }
}

.other-tab-content {
  padding: 120px 0;
}

// 欢迎界面
.welcome-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, var(--n-hover-color) 0%, var(--n-color) 100%);

  .welcome-content {
    text-align: center;
    animation: fadeInUp 0.6s ease;

    .welcome-icon {
      font-size: 120px;
      color: var(--n-primary-color);
      margin-bottom: 32px;
      opacity: 0.8;
      animation: float 3s ease-in-out infinite;
    }

    h2 {
      font-size: 32px;
      font-weight: 700;
      color: var(--n-text-color);
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }

    p {
      font-size: 16px;
      color: var(--n-text-color-3);
      margin: 0;
      font-weight: 500;
    }
  }
}

// 动画
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

// 鍝嶅簲寮?
@media (max-width: 1400px) {
  .search-result-header,
  .search-tabs-wrapper .tabs-container,
  .search-content {
    padding-left: 16px;
    padding-right: 16px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 16px;
  }

  .col-album {
    display: none !important;
  }

  .artists-result-container,
  .playlists-result-container {
    .artists-list,
    .playlists-list {
      grid-template-columns: 1fr;
    }
  }

  .artist-card,
  .playlist-card {
    padding: 10px;
  }
}

// 添加到歌单弹窗样式
.playlist-selection {
  .create-new-playlist {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    color: var(--n-text-color);
    font-weight: 500;

    &:hover {
      background-color: var(--n-hover-color);
    }
  }

  .playlist-list {
    max-height: 400px;
    overflow-y: auto;
    margin-top: 8px;

    .playlist-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        background-color: var(--n-hover-color);
      }

      &.selected {
        background-color: color-mix(in srgb, var(--n-primary-color) 16%, transparent);
        border: 1px solid var(--n-primary-color);
      }

      .playlist-cover {
        flex-shrink: 0;
        border-radius: 6px;
        overflow: hidden;
      }

      .playlist-info {
        flex: 1;
        min-width: 0;

        .playlist-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--n-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .playlist-count {
          font-size: 12px;
          color: var(--n-text-color-3);
          margin-top: 4px;
        }
      }

      .check-icon {
        color: var(--n-primary-color);
        font-size: 20px;
      }
    }

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--n-pressed-color);
      border-radius: 3px;

      &:hover {
        background: var(--n-pressed-color);
      }
    }
  }
}
</style>
