<template>
  <div class="playlist-detail">
    <!-- 固定顶部栏 (绝对定位，覆盖在滚动容器之上) -->
    <div class="fixed-header" :class="{ visible: isScrolled }">
      <div class="fixed-header-content">
        <div class="left-section">
          <a-button type="text" class="back-btn" @click="goBack">
            <icon-left />
          </a-button>
          <span class="playlist-name">{{ playlist.name }}</span>
        </div>
        <div class="right-section">
          <a-button type="primary" shape="round" @click="playAll">
            <template #icon><icon-play-arrow-fill /></template>
            播放全部
          </a-button>
          <a-button shape="round" :loading="isDownloading" @click="downloadAll">
            <template #icon><icon-download /></template>
            下载
          </a-button>
          <a-button shape="circle" :disabled="playlist.isLocal" @click="toggleFavorite">
            <template #icon>
              <icon-star-fill v-if="isFavorited" />
              <icon-star v-else />
            </template>
          </a-button>
        </div>
      </div>
    </div>

    <!-- 滚动容器 (包含大头部和列表) -->
    <div ref="scrollContainerRef" class="scroll-container" @scroll="handleScroll">
      <!-- 完整头部信息区 -->
      <div class="detail-header">
        <a-page-header :style="{ background: 'transparent' }" @back="goBack">
          <!-- 这里的标题留空，因为大标题在下面 -->
        </a-page-header>

        <div class="playlist-info-section">
          <div class="cover-section">
            <a-image :src="playlist.cover" :width="200" :height="200" fit="cover" />
          </div>
          <div class="info-section">
            <h2 class="playlist-title">{{ playlist.name }}</h2>
            <div class="playlist-meta">
              <div class="creator-info">
                <span v-if="playlist.createTime" class="create-time"
                  >{{ playlist.createTime }}创建</span
                >
              </div>
            </div>
            <div class="playlist-description">
              {{ playlist.description || '' }}
            </div>
            <div class="action-buttons">
              <a-button type="primary" size="large" class="play-all-btn" @click="playAll">
                <template #icon><icon-play-arrow-fill /></template>
                播放全部
              </a-button>
              <a-button
                size="large"
                class="action-btn"
                :loading="isDownloading"
                @click="downloadAll"
              >
                <template #icon><icon-download /></template>
                下载
              </a-button>
              <a-button
                size="large"
                class="action-btn"
                :disabled="playlist.isLocal"
                @click="toggleFavorite"
              >
                <template #icon>
                  <icon-star-fill v-if="isFavorited" />
                  <icon-star v-else />
                </template>
                {{ isFavorited ? '已收藏' : '收藏' }}
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 歌曲列表区域 -->
      <div class="song-list-section">
        <!-- 列表表头 (Sticky) -->
        <div class="list-header">
          <div class="header-row">
            <div class="col-index">#</div>
            <div class="col-title">标题</div>
            <div class="col-album">专辑</div>
            <div class="col-like">喜欢</div>
            <div class="col-duration">时长</div>
          </div>
        </div>

        <!-- 加载中状态 -->
        <div v-if="isLoading" class="list-body">
          <div v-for="index in 10" :key="'skeleton-' + index" class="song-item skeleton-item">
            <div class="col-index">
              <a-skeleton-line :rows="1" :line-height="20" :line-spacing="0" animation />
            </div>
            <div class="col-title">
              <a-skeleton :animation="true">
                <a-skeleton-shape shape="square" :size="40" />
                <a-space direction="vertical" :size="4" style="flex: 1; margin-left: 12px">
                  <a-skeleton-line :rows="1" :line-height="16" :line-spacing="0" />
                  <a-skeleton-line :rows="1" :line-height="14" :line-spacing="0" />
                </a-space>
              </a-skeleton>
            </div>
            <div class="col-album">
              <a-skeleton-line :rows="1" :line-height="16" :line-spacing="0" animation />
            </div>
            <div class="col-like">
              <a-skeleton-line :rows="1" :line-height="20" :line-spacing="0" animation />
            </div>
            <div class="col-duration">
              <a-skeleton-line :rows="1" :line-height="16" :line-spacing="0" animation />
            </div>
          </div>
        </div>

        <!-- 实际歌曲列表 -->
        <div v-else ref="listBodyRef" class="list-body">
          <div class="songs-render-layer" :style="{ height: `${virtualizerTotalSize}px` }">
            <div
              v-for="item in virtualRowItems"
              :key="item.row.key"
              class="song-item virtual-row"
              :class="{ active: currentSong?.id === item.song.id }"
              :style="{ transform: `translateY(${item.row.start - listScrollMargin}px)` }"
              @dblclick="playSong(item.song, item.row.index)"
            >
              <div class="col-index">
                <span class="index-number">
                  {{ String(item.row.index + 1).padStart(2, '0') }}
                </span>
                <div class="play-icon-wrapper" @click.stop="playSong(item.song, item.row.index)">
                  <icon-play-arrow-fill />
                </div>
                <icon-play-arrow-fill
                  v-if="currentSong?.id === item.song.id"
                  class="playing-indicator"
                />
              </div>

              <div class="col-title">
                <div class="song-cover">
                  <a-image :src="item.song.cover" :width="40" :height="40" fit="cover" />
                </div>
                <div class="song-info">
                  <div class="song-name">
                    <span v-if="item.song.vip" class="vip-badge">VIP</span>
                    {{ item.song.name }}
                  </div>
                  <div class="song-artist">{{ item.song.artist }}</div>
                </div>
              </div>

              <!-- 专辑列 (默认显示) -->
              <div class="col-album">
                <span class="album-name">{{ item.song.album }}</span>
              </div>

              <!-- 操作列 (悬停显示，占据专辑列的位置) -->
              <div class="col-operations">
                <a-tooltip content="添加到歌单">
                  <icon-folder-add @click.stop="addToPlaylist(item.song)" />
                </a-tooltip>
                <a-tooltip content="下载">
                  <icon-download @click.stop="handleDownloadSong(item.song)" />
                </a-tooltip>
                <a-tooltip content="评论"><icon-message /></a-tooltip>
                <a-tooltip v-if="playlist.isLocal" content="从歌单中删除">
                  <icon-delete
                    class="delete-icon"
                    @click.stop="deleteSongFromPlaylist(item.song)"
                  />
                </a-tooltip>
                <a-tooltip content="更多"><icon-more /></a-tooltip>
              </div>

              <div class="col-like">
                <div
                  class="like-btn"
                  :class="{ liked: item.song.liked }"
                  @click.stop="toggleLike(item.song)"
                >
                  <icon-heart-fill v-if="item.song.liked" />
                  <icon-heart v-else />
                </div>
              </div>

              <div class="col-duration">{{ item.song.duration }}</div>
            </div>
          </div>
        </div>
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
            v-for="item in createdPlaylists"
            :key="item.id"
            class="playlist-option"
            :class="{ selected: selectedPlaylistId === item.id }"
            @click="selectPlaylist(item.id)"
          >
            <div class="playlist-cover">
              <a-image :src="getPlaylistCover(item)" :width="40" :height="40" fit="cover" />
            </div>
            <div class="playlist-info">
              <div class="playlist-name">{{ item.name }}</div>
              <div class="playlist-count">{{ item.songs?.length || 0 }} 首歌曲</div>
            </div>
            <icon-check-circle-fill v-if="selectedPlaylistId === item.id" class="check-icon" />
          </div>
        </div>
        <a-empty v-if="createdPlaylists.length === 0" description="暂无歌单，请先创建" />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, toRaw, watch, computed, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconPlayArrowFill,
  IconDownload,
  IconMore,
  IconHeart,
  IconHeartFill,
  IconLeft,
  IconFolderAdd,
  IconMessage,
  IconPlusCircle,
  IconCheckCircleFill,
  IconStar,
  IconStarFill,
  IconDelete
} from '@arco-design/web-vue/es/icon'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { formatDate } from '@/utils/utils'
import { downloadSong, downloadSongs } from '@/utils/downloadUtils'

const isScrolled = ref(false)
const scrollContainerRef = ref(null)
const listBodyRef = ref(null)
const indexStore = useIndexStore()
const playlistStore = usePlaylistStore()
const songStore = useSongStore()

const { setCurIndex } = indexStore
const { currentPlaylistInfo, createdPlaylists } = storeToRefs(playlistStore)
const { currentSong } = storeToRefs(songStore)
const { refreshKey } = storeToRefs(indexStore)

// 歌单信息
const playlist = ref({
  id: currentPlaylistInfo.value.id,
  name: currentPlaylistInfo.value.name,
  cover: currentPlaylistInfo.value.cover || 'https://via.placeholder.com/200',
  description: currentPlaylistInfo.value.description,
  createTime: formatDate(currentPlaylistInfo.value.createTime),
  isLocal: currentPlaylistInfo.value.isLocal || false
})

// 歌曲列表数据
const songs = ref([])

// 加载状态
const isLoading = ref(false)

// 添加到歌单相关
const addToPlaylistModalVisible = ref(false)
const selectedPlaylistId = ref(null)
const currentSongToAdd = ref(null)

// 收藏状态
const isFavorited = ref(false)

// 下载状态
const isDownloading = ref(false)

// 虚拟滚动（TanStack）
const VIRTUAL_OVERSCAN = 8
const listScrollMargin = ref(0)

const updateListScrollMargin = () => {
  const container = scrollContainerRef.value
  const listBody = listBodyRef.value
  if (!container || !listBody) return

  const containerRect = container.getBoundingClientRect()
  const listRect = listBody.getBoundingClientRect()
  listScrollMargin.value = listRect.top - containerRect.top + container.scrollTop
}

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: songs.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 60,
    overscan: VIRTUAL_OVERSCAN,
    enabled: !isLoading.value,
    scrollMargin: listScrollMargin.value
  }))
)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const virtualizerTotalSize = computed(() => rowVirtualizer.value.getTotalSize())
const virtualRowItems = computed(() =>
  virtualRows.value
    .map((row) => ({ row, song: songs.value[row.index] }))
    .filter((item) => Boolean(item.song))
)

// 处理滚动 - 监听 scrollContainer
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  isScrolled.value = scrollTop > 220
}

const goBack = () => {
  // 返回到上一个页面，如果没有记录则返回主页
  const previousPage = indexStore.previousIndex || 'mainpage'
  setCurIndex(previousPage)
}

const playAll = () => {
  if (songs.value.length > 0) {
    // 使用 playlistStore 的方法播放整个歌单
    playlistStore.setCurrentPlaylistSongs(songs.value)
    const success = playlistStore.playCurrentPlaylist()
    if (success) {
      Message.success('开始播放全部歌曲')
    }
  }
}

const downloadAll = async () => {
  if (songs.value.length === 0) {
    Message.warning('歌单为空')
    return
  }

  // 过滤掉本地音乐
  const onlineSongs = songs.value.filter((song) => !song.url && !song.path)
  if (onlineSongs.length === 0) {
    Message.warning('没有可下载的在线歌曲')
    return
  }

  isDownloading.value = true
  try {
    await downloadSongs(onlineSongs)
  } finally {
    isDownloading.value = false
  }
}

const handleDownloadSong = async (song) => {
  await downloadSong(song)
}

const playSong = (song, index) => {
  // 使用 playlistStore 的方法播放指定歌曲
  playlistStore.setCurrentPlaylistSongs(songs.value)
  playlistStore.playCurrentPlaylistSong(index)
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

// 从歌单中删除歌曲
const deleteSongFromPlaylist = async (song) => {
  Modal.warning({
    title: '确认删除',
    content: `确定要从歌单中删除「${song.name}」吗？`,
    okText: '删除',
    cancelText: '取消',
    hideCancel: false,
    onOk: async () => {
      try {
        const success = await playlistStore.removeSongFromLocalPlaylist(playlist.value.id, song.id)
        if (success) {
          // 从本地列表中移除
          songs.value = songs.value.filter((s) => s.id !== song.id)
          // 更新封面（如果删除的是第一首歌）
          if (songs.value.length > 0 && songs.value[0].cover) {
            playlist.value.cover = songs.value[0].cover
          }
          Message.success('删除成功')
          // 重新加载歌单数据
          await playlistStore.loadLocalPlaylists()
        } else {
          Message.error('删除失败')
        }
      } catch (error) {
        console.error('删除歌曲失败:', error)
        Message.error('删除失败: ' + error.message)
      }
    }
  })
}

const addToPlaylist = (song) => {
  currentSongToAdd.value = song
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

  if (!currentSongToAdd.value) {
    Message.error('没有选择要添加的歌曲')
    return false
  }

  try {
    // 转换为纯对象，避免响应式代理导致的序列化问题
    const songToAdd = toRaw(currentSongToAdd.value)
    const playlistId = selectedPlaylistId.value

    console.log('添加歌曲:', { playlistId, song: songToAdd })

    const success = await playlistStore.addSongToLocalPlaylist(playlistId, songToAdd)

    if (success) {
      Message.success('添加成功')
      // 重新加载歌单数据以确保同步
      await playlistStore.loadLocalPlaylists()
      currentSongToAdd.value = null
      selectedPlaylistId.value = null
      return true
    } else {
      console.log(success)
      Message.warning('歌曲已存在于该歌单中')
      return false
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
}

const handleCreateNewPlaylist = () => {
  addToPlaylistModalVisible.value = false
  Message.info('请在侧边栏创建新歌单')
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

// 切换收藏状态
const toggleFavorite = async () => {
  if (playlist.value.isLocal) {
    Message.warning('本地歌单无需收藏')
    return
  }

  try {
    if (isFavorited.value) {
      // 取消收藏
      const success = await playlistStore.removeFromFavoritePlaylist(playlist.value.id)
      if (success) {
        isFavorited.value = false
        Message.success('已取消收藏')
      } else {
        Message.error('取消收藏失败')
      }
    } else {
      // 添加收藏
      const success = await playlistStore.addToFavoritePlaylist({
        id: playlist.value.id,
        name: playlist.value.name,
        cover: playlist.value.cover,
        description: playlist.value.description,
        createTime: playlist.value.createTime,
        isLocal: false
      })
      if (success) {
        isFavorited.value = true
        Message.success('收藏成功')
      } else {
        Message.warning('该歌单已收藏')
      }
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    Message.error('操作失败')
  }
}

// 加载歌单数据的独立方法
const loadPlaylistData = async () => {
  if (!currentPlaylistInfo.value.id) return

  isLoading.value = true
  const loadStartTime = performance.now()
  console.log('开始加载歌单:', currentPlaylistInfo.value.name)

  // 重置歌单信息
  playlist.value = {
    id: currentPlaylistInfo.value.id,
    name: currentPlaylistInfo.value.name,
    cover: currentPlaylistInfo.value.cover || '',
    description: currentPlaylistInfo.value.description,
    createTime: formatDate(currentPlaylistInfo.value.createTime),
    isLocal: currentPlaylistInfo.value.isLocal || false
  }

  try {
    // 判断是否为本地歌单
    if (currentPlaylistInfo.value.isLocal) {
      // 本地歌单：从本地存储加载
      isFavorited.value = false // 本地歌单不显示收藏状态
      const localPlaylist = await window.api.getPlaylistById(playlist.value.id)
      if (localPlaylist && localPlaylist.songs) {
        const normalizeStartTime = performance.now()
        songs.value = localPlaylist.songs.map((song) => playlistStore.normalizeSong(song))
        const normalizeTime = (performance.now() - normalizeStartTime).toFixed(2)
        console.log(`标准化${localPlaylist.songs.length}首歌曲耗时: ${normalizeTime}ms`)

        playlistStore.setCurrentPlaylistSongs(songs.value)
        // 本地歌单封面由第一首歌决定
        if (songs.value.length > 0 && songs.value[0].cover) {
          playlist.value.cover = songs.value[0].cover
        } else if (!playlist.value.cover) {
          playlist.value.cover = 'https://via.placeholder.com/200'
        }
        console.log('Loaded local playlist songs:', songs.value.length, '首')
      }
    } else {
      // 网易云歌单：通过 API 加载
      // 检查是否已收藏
      isFavorited.value = playlistStore.favoritePlaylists.some((p) => p.id === playlist.value.id)
      const responseSongs = await window.api.getPlaylistsAllSongs(playlist.value.id)
      if (responseSongs && responseSongs.body.songs) {
        const normalizeStartTime = performance.now()
        // 标准化歌曲数据，liked状态会根据likedSongIds自动设置
        songs.value = responseSongs.body.songs.map((song) => playlistStore.normalizeSong(song))
        const normalizeTime = (performance.now() - normalizeStartTime).toFixed(2)
        console.log(`标准化${responseSongs.body.songs.length}首歌曲耗时: ${normalizeTime}ms`)

        playlistStore.setCurrentPlaylistSongs(songs.value)
        const likedCount = songs.value.filter((s) => s.liked).length
        console.log(`在线歌单加载完成: ${songs.value.length}首，其中${likedCount}首喜欢的歌曲`)
      }
    }

    const totalLoadTime = (performance.now() - loadStartTime).toFixed(2)
    console.log(`歌单"${playlist.value.name}"加载完成，总耗时: ${totalLoadTime}ms`)
  } catch (error) {
    console.error('Failed to load playlist songs:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadPlaylistData()
  await nextTick()
  updateListScrollMargin()
  rowVirtualizer.value.measure()
  window.addEventListener('resize', updateListScrollMargin)
  console.log(currentPlaylistInfo.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateListScrollMargin)
})

watch(
  () => songs.value.length,
  async () => {
    await nextTick()
    updateListScrollMargin()
    rowVirtualizer.value.measure()
  }
)

// 监听 currentPlaylistInfo 和 refreshKey 的变化，重新加载数据
watch([() => currentPlaylistInfo.value.id, refreshKey], async () => {
  console.log('歌单信息变化，重新加载')
  await loadPlaylistData()
  await nextTick()
  updateListScrollMargin()
  rowVirtualizer.value.measure()
  // 滚动到顶部
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0
  }
})
</script>

<style lang="scss" scoped>
@import './playlistDetail.scss';
</style>
