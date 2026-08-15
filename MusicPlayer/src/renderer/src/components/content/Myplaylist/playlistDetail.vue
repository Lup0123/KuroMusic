<template>
  <div class="playlist-detail">
    <!-- 固定顶部栏 -->
    <div class="fixed-header" :class="{ visible: isScrolled }">
      <div class="fixed-header-content">
        <div class="left-section">
          <n-button text class="back-btn" @click="goBack">
            <n-icon><ChevronBack /></n-icon>
          </n-button>
          <span class="playlist-name">{{ playlist.name }}</span>
        </div>
        <div class="right-section">
          <n-button type="primary" round @click="playAll">
            <template #icon
              ><n-icon><PlaySharp /></n-icon
            ></template>
            播放全部
          </n-button>
          <n-button round :loading="isDownloading" @click="downloadAll">
            <template #icon
              ><n-icon><DownloadOutline /></n-icon
            ></template>
            下载
          </n-button>
          <n-button circle :disabled="playlist.isLocal" @click="toggleFavorite">
            <template #icon>
              <n-icon><Star v-if="isFavorited" /><StarOutline v-else /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 滚动容器 -->
    <div ref="scrollContainerRef" class="scroll-container" @scroll="handleScroll">
      <!-- 头部信息区 -->
      <div class="detail-header">
        <div class="header-back" style="height: auto; padding: 12px">
          <n-button text @click="goBack">
            <n-icon size="20"><ChevronBack /></n-icon>
          </n-button>
        </div>

        <div class="playlist-info-section">
          <div class="cover-section">
            <AppCover
              class="cover-box"
              :src="playlist.cover"
              :width="200"
              :height="200"
              :size="400"
            />
          </div>
          <div class="info-section">
            <h2 class="playlist-title">{{ playlist.name }}</h2>
            <div class="playlist-meta">
              <div class="creator-info">
                <span v-if="playlist.createTime" class="create-time">
                  {{ playlist.createTime }} 创建
                </span>
              </div>
            </div>
            <div class="playlist-description">{{ playlist.description || '' }}</div>
            <div class="action-buttons">
              <n-button type="primary" size="large" round class="play-all-btn" @click="playAll">
                <template #icon
                  ><n-icon><PlaySharp /></n-icon
                ></template>
                播放全部
              </n-button>
              <n-button size="large" round :loading="isDownloading" @click="downloadAll">
                <template #icon
                  ><n-icon><DownloadOutline /></n-icon
                ></template>
                下载
              </n-button>
              <n-button size="large" round :disabled="playlist.isLocal" @click="toggleFavorite">
                <template #icon>
                  <n-icon><Star v-if="isFavorited" /><StarOutline v-else /></n-icon>
                </template>
                {{ isFavorited ? '已收藏' : '收藏' }}
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 歌曲列表区域 -->
      <div class="song-list-section">
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
              <n-skeleton text :width="20" />
            </div>
            <div class="col-title">
              <n-skeleton :width="40" :height="40" />
              <div class="skeleton-text">
                <n-skeleton text :width="120" />
                <n-skeleton text :width="80" style="margin-top: 4px" />
              </div>
            </div>
            <div class="col-album">
              <n-skeleton text :width="100" />
            </div>
            <div class="col-like">
              <n-skeleton text :width="20" />
            </div>
            <div class="col-duration">
              <n-skeleton text :width="40" />
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
                  <n-icon><PlaySharp /></n-icon>
                </div>
                <n-icon v-if="currentSong?.id === item.song.id" class="playing-indicator">
                  <PlaySharp />
                </n-icon>
              </div>

              <div class="col-title">
                <div class="song-cover">
                  <AppCover
                    :src="item.song.cover"
                    :width="40"
                    :height="40"
                    :size="80"
                    :radius="4"
                  />
                </div>
                <div class="song-info">
                  <div class="song-name">
                    <span v-if="item.song.vip" class="vip-badge">VIP</span>
                    {{ item.song.name }}
                  </div>
                  <div class="song-artist">{{ item.song.artist }}</div>
                </div>
              </div>

              <div class="col-album">
                <span class="album-name">{{ item.song.album }}</span>
              </div>

              <div class="col-operations">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon @click.stop="playSongNext(item.song)"
                      ><PlaySkipForwardOutline
                    /></n-icon>
                  </template>
                  下一首播放
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon @click.stop="addToPlaylist(item.song)"><FolderOpenOutline /></n-icon>
                  </template>
                  添加到歌单
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon @click.stop="handleDownloadSong(item.song)"><DownloadOutline /></n-icon>
                  </template>
                  下载
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon><ChatboxOutline /></n-icon>
                  </template>
                  评论
                </n-tooltip>
                <n-tooltip v-if="playlist.isLocal" trigger="hover">
                  <template #trigger>
                    <n-icon class="delete-icon" @click.stop="deleteSongFromPlaylist(item.song)">
                      <TrashOutline />
                    </n-icon>
                  </template>
                  从歌单中删除
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon><EllipsisHorizontal /></n-icon>
                  </template>
                  更多
                </n-tooltip>
              </div>

              <div class="col-like">
                <div
                  class="like-btn"
                  :class="{ liked: item.song.liked }"
                  @click.stop="toggleLike(item.song)"
                >
                  <n-icon><Heart v-if="item.song.liked" /><HeartOutline v-else /></n-icon>
                </div>
              </div>

              <div class="col-duration"><SongDurationText :song="item.song" /></div>
            </div>
          </div>
        </div>
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
            v-for="item in createdPlaylists"
            :key="item.id"
            class="playlist-option"
            :class="{ selected: selectedPlaylistId === item.id }"
            @click="selectPlaylist(item.id)"
          >
            <div class="playlist-cover">
              <AppCover
                :src="getPlaylistCover(item)"
                :width="40"
                :height="40"
                :size="80"
                :radius="6"
              />
            </div>
            <div class="playlist-info">
              <div class="playlist-name">{{ item.name }}</div>
              <div class="playlist-count">{{ item.songs?.length || 0 }} 首歌曲</div>
            </div>
            <n-icon v-if="selectedPlaylistId === item.id" class="check-icon">
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
import { ref, onMounted, onBeforeUnmount, toRaw, watch, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useDialog } from 'naive-ui'
import {
  PlaySharp,
  DownloadOutline,
  EllipsisHorizontal,
  HeartOutline,
  Heart,
  ChevronBack,
  FolderOpenOutline,
  ChatboxOutline,
  PlaySkipForwardOutline,
  AddCircleOutline,
  CheckmarkCircle,
  StarOutline,
  Star,
  TrashOutline
} from '@vicons/ionicons5'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { formatDate } from '@/utils/utils'
import { downloadSong, downloadSongs } from '@/utils/downloadUtils'
import { ROUTE_NAMES } from '@/router/routeNames'
import AppCover from '@/components/common/AppCover.vue'
import SongDurationText from '@/components/common/SongDurationText.vue'
import { useAppFeedback } from '@/composables/useAppFeedback'

const feedback = useAppFeedback()
const dialog = useDialog()

const isScrolled = ref(false)
const scrollContainerRef = ref(null)
const listBodyRef = ref(null)
const router = useRouter()
const indexStore = useIndexStore()
const playlistStore = usePlaylistStore()
const songStore = useSongStore()

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

// 铏氭嫙婊氬姩
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

const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  isScrolled.value = scrollTop > 220
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: ROUTE_NAMES.MAIN_PAGE })
}

const playAll = () => {
  if (songs.value.length > 0) {
    playlistStore.setCurrentPlaylistSongs(songs.value)
    const success = playlistStore.playCurrentPlaylist()
    if (success) {
      feedback.success('开始播放全部歌曲')
    }
  }
}

const downloadAll = async () => {
  if (songs.value.length === 0) {
    feedback.warning('歌单为空')
    return
  }

  const onlineSongs = songs.value.filter((song) => !song.url && !song.path)
  if (onlineSongs.length === 0) {
    feedback.warning('没有可下载的在线歌曲')
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
  playlistStore.setCurrentPlaylistSongs(songs.value)
  playlistStore.playCurrentPlaylistSong(index)
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

// 从歌单中删除歌曲
const deleteSongFromPlaylist = async (song) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要从歌单中删除「${song.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const success = await playlistStore.removeSongFromLocalPlaylist(playlist.value.id, song.id)
        if (success) {
          songs.value = songs.value.filter((s) => s.id !== song.id)
          if (songs.value.length > 0 && songs.value[0].cover) {
            playlist.value.cover = songs.value[0].cover
          }
          feedback.success('删除成功')
          await playlistStore.loadLocalPlaylists()
        } else {
          feedback.error('删除失败')
        }
      } catch (error) {
        console.error('删除歌曲失败:', error)
        feedback.errorWith(error, '删除失败，请稍后重试')
      }
    }
  })
}

const addToPlaylist = (song) => {
  currentSongToAdd.value = song
  selectedPlaylistId.value = null
  addToPlaylistModalVisible.value = true
}

const playSongNext = (song) => {
  songStore.playSongNext(song)
  feedback.success(`已加入「下一首播放」：${song.name}`)
}

const selectPlaylist = (playlistId) => {
  selectedPlaylistId.value = playlistId
}

const handleAddToPlaylist = async () => {
  if (!selectedPlaylistId.value) {
    feedback.warning('请选择一个歌单')
    return false
  }

  if (!currentSongToAdd.value) {
    feedback.error('没有选择要添加的歌曲')
    return false
  }

  try {
    const songToAdd = toRaw(currentSongToAdd.value)
    const playlistId = selectedPlaylistId.value

    const success = await playlistStore.addSongToLocalPlaylist(playlistId, songToAdd)

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
}

const handleCreateNewPlaylist = () => {
  addToPlaylistModalVisible.value = false
  feedback.info('请在侧边栏创建新歌单')
}

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

const toggleFavorite = async () => {
  if (playlist.value.isLocal) {
    feedback.warning('本地歌单无需收藏')
    return
  }

  try {
    if (isFavorited.value) {
      const success = await playlistStore.removeFromFavoritePlaylist(playlist.value.id)
      if (success) {
        isFavorited.value = false
        feedback.success('已取消收藏')
      } else {
        feedback.error('取消收藏失败')
      }
    } else {
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
        feedback.success('收藏成功')
      } else {
        feedback.warning('该歌单已收藏')
      }
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    feedback.error('操作失败')
  }
}

const loadPlaylistData = async () => {
  if (!currentPlaylistInfo.value.id) return

  isLoading.value = true
  const loadStartTime = performance.now()

  playlist.value = {
    id: currentPlaylistInfo.value.id,
    name: currentPlaylistInfo.value.name,
    cover: currentPlaylistInfo.value.cover || '',
    description: currentPlaylistInfo.value.description,
    createTime: formatDate(currentPlaylistInfo.value.createTime),
    isLocal: currentPlaylistInfo.value.isLocal || false
  }

  try {
    if (currentPlaylistInfo.value.isLocal) {
      isFavorited.value = false
      const localPlaylist = await window.api.getPlaylistById(playlist.value.id)
      if (localPlaylist && localPlaylist.songs) {
        songs.value = localPlaylist.songs.map((song) => playlistStore.normalizeSong(song))
        playlistStore.setCurrentPlaylistSongs(songs.value)
        if (songs.value.length > 0 && songs.value[0].cover) {
          playlist.value.cover = songs.value[0].cover
        } else if (!playlist.value.cover) {
          playlist.value.cover = 'https://via.placeholder.com/200'
        }
      }
    } else {
      isFavorited.value = playlistStore.favoritePlaylists.some((p) => p.id === playlist.value.id)
      const responseSongs = await window.api.getPlaylistsAllSongs(playlist.value.id)
      if (responseSongs && responseSongs.body.songs) {
        songs.value = responseSongs.body.songs.map((song) => playlistStore.normalizeSong(song))
        playlistStore.setCurrentPlaylistSongs(songs.value)
      }
    }

    const totalLoadTime = (performance.now() - loadStartTime).toFixed(2)
    console.log(`歌单"${playlist.value.name}"加载完成，耗时: ${totalLoadTime}ms`)
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

watch([() => currentPlaylistInfo.value.id, refreshKey], async () => {
  await loadPlaylistData()
  await nextTick()
  updateListScrollMargin()
  rowVirtualizer.value.measure()
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0
  }
})
</script>

<style lang="scss" scoped>
.playlist-detail {
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--n-color); // 使用背景色变量
  overflow: hidden;

  // 1. 固定顶部栏（绝对定位）
  .fixed-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: var(--color-bg-popup); // 使用弹出层背景色（通常带透明度）
    backdrop-filter: blur(20px);
    z-index: 100;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    pointer-events: none;
    border-bottom: 1px solid var(--n-border-color); // 使用边框变量

    &.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .fixed-header-content {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;

      .left-section {
        display: flex;
        align-items: center;
        gap: 12px;

        .back-btn {
          color: var(--n-text-color); // 主要文本色
          font-size: 18px;
        }

        .playlist-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--n-text-color);
        }
      }

      .right-section {
        display: flex;
        gap: 12px;
      }
    }
  }

  // 2. 滚动容器
  .scroll-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--n-pressed-color); // 滚动条颜色
      border-radius: 3px;
    }

    .detail-header {
      background: linear-gradient(
        180deg,
        rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.15) 0%,
        var(--n-color) 100%
      );

      .playlist-info-section {
        display: flex;
        padding: 0% 40px 40px;
        gap: 30px;

        .cover-section {
          flex-shrink: 0;
          :deep(.ant-image) {
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          }
        }

        .info-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding-top: 10px;

          .playlist-title {
            font-size: 30px;
            font-weight: 700;
            color: var(--n-text-color);
            margin: 0 0 12px 0;
          }

          .playlist-meta {
            margin-bottom: 12px;
            .creator-info {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              color: var(--n-text-color-2); // 次要文本色

              .creator-name {
                color: rgb(var(--link-6)); // 链接色
                cursor: pointer;
              }
            }
          }

          .playlist-description {
            font-size: 13px;
            margin-bottom: auto;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .action-buttons {
            display: flex;
            gap: 12px;
            margin-top: 20px;

            .play-all-btn {
              border: none;
              border-radius: 20px;
              padding: 0 24px;
            }

            .action-btn {
              background: var(--n-hover-color); // 填充背景
              border: 1px solid var(--n-border-color);
              color: var(--n-text-color);
              border-radius: 20px;
              &:hover {
                background: var(--n-pressed-color);
              }
            }
          }
        }
      }
    }

    .song-list-section {
      --list-side-padding: 32px;
      --row-horizontal-padding: 10px;
      --col-index-width: 50px;
      --col-album-width: 200px;
      --col-album-min-width: 150px;
      --col-like-width: 60px;
      --col-duration-width: 60px;

      padding-bottom: 80px;

      .list-header {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--n-color); // 必须与背景一致
        padding: 0 var(--list-side-padding);
        border-bottom: 1px solid var(--n-border-color);

        .header-row {
          display: flex;
          height: 36px;
          align-items: center;
          color: var(--n-text-color-3);
          font-size: 13px;
        }
      }

      .list-body {
        padding: 0 var(--list-side-padding);

        .songs-render-layer {
          width: 100%;
          position: relative;
        }

        .virtual-row {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          width: auto;
          will-change: transform;
        }
      }

      // 通用列宽定义
      .col-index {
        width: var(--col-index-width);
        text-align: center;
        flex-shrink: 0;
        color: var(--n-text-color-disabled);
        font-size: 13px;
        position: relative;
      }
      .col-title {
        flex: 1;
        min-width: 200px;
        display: flex;
        align-items: center;
        gap: 12px;
        overflow: hidden;
      }
      .col-operations {
        width: 200px;
        min-width: 150px;
        display: none;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;

        .delete-icon {
          &:hover {
            color: var(--n-error-color);
          }
        }
      }
      .col-album {
        width: var(--col-album-width);
        min-width: var(--col-album-min-width);
        color: var(--n-text-color-3);
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .col-like {
        width: var(--col-like-width);
        text-align: center;
        flex-shrink: 0;
      }
      .col-duration {
        width: var(--col-duration-width);
        text-align: right;
        flex-shrink: 0;
        color: var(--n-text-color-disabled);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }

      .song-item {
        display: flex;
        align-items: center;
        height: 60px;
        border-radius: 4px;
        padding: 0 var(--row-horizontal-padding);
        margin: 0 calc(-1 * var(--row-horizontal-padding));
        transition: background 0.2s;

        &:hover {
          background: var(--n-hover-color); // 鎮仠鑳屾櫙

          .col-index {
            .index-number {
              display: none;
            }
            .play-icon-wrapper {
              display: flex;
            }
          }

          .col-operations {
            display: flex;
          }
        }

        &.active {
          .col-index {
            .index-number {
              display: none;
            }
            .play-icon-wrapper {
              display: none;
            }
            .playing-indicator {
              display: block;
              color: var(--n-primary-color);
            }
          }
          .song-name {
            color: var(--n-primary-color) !important;
          }
        }

        // 序号列内部元素
        .col-index {
          .play-icon-wrapper {
            display: none;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            color: var(--n-text-color-2);
            cursor: pointer;
            &:hover {
              color: var(--n-text-color);
            }
          }
          .playing-indicator {
            display: none;
            margin: 0 auto;
          }
        }

        // 标题列内容
        .col-title {
          .song-cover :deep(img) {
            border-radius: 4px;
          }
          .song-info {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            .song-name {
              color: var(--n-text-color);
              font-size: 14px;
              margin-bottom: 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .song-artist {
              color: var(--n-text-color-3);
              font-size: 12px;
            }
            .vip-badge {
              border: 1px solid var(--n-primary-color);
              color: var(--n-primary-color);
              font-size: 10px;
              padding: 0 2px;
              border-radius: 2px;
              margin-right: 4px;
            }
          }
        }

        // 操作列图标
        .col-operations {
          .ant-icon {
            font-size: 18px;
            color: var(--n-text-color-3);
            cursor: pointer;
            transition: color 0.2s;
            &:hover {
              color: var(--n-text-color);
            }
          }
        }

        // 喜欢按钮
        .col-like {
          .like-btn {
            cursor: pointer;
            color: var(--n-text-color-disabled);
            &:hover {
              color: var(--n-text-color-2);
            }
            &.liked {
              color: var(--n-primary-color);
            }
          }
        }
      }

      // 骨架屏与真实行使用同一列宽和行内布局，避免加载前后跳动
      .skeleton-item {
        opacity: 0.6;
        pointer-events: none;

        .col-index,
        .col-album,
        .col-like,
        .col-duration {
          display: flex;
          align-items: center;
        }

        .col-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        &:hover {
          background: transparent;

          .col-album {
            opacity: 1;
          }

          .col-operations {
            opacity: 0;
          }
        }
      }
    }

    // 空状态
    :deep(.ant-empty) {
      padding: 60px 0;

      .ant-empty-description {
        color: var(--n-text-color-3);
        font-size: 14px;
      }

      .ant-btn-primary {
        background: var(--n-primary-color);
        border: none;

        &:hover {
          opacity: 0.9;
        }
      }
    }
  }

  // 滚动条样式
  .song-list-section {
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--n-pressed-color);
      border-radius: 3px;
      transition: background 0.2s;

      &:hover {
        background: var(--n-pressed-color);
      }
    }
  }

  // 播放图标动画
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  // 响应式设置
  @media (max-width: 1200px) {
    .playlist-detail {
      .song-list-section {
        --col-album-width: 150px;
        --col-album-min-width: 120px;
      }
    }
  }

  @media (max-width: 768px) {
    .playlist-detail {
      .detail-header {
        .playlist-info-section {
          flex-direction: column;
          align-items: center;
          text-align: center;

          .cover-section {
            :deep(.ant-image) {
              width: 160px;
              height: 160px;
            }
          }

          .info-section {
            width: 100%;

            .action-buttons {
              justify-content: center;
            }
          }
        }
      }

      .song-list-section {
        .col-album,
        .col-operations {
          display: none;
        }
      }

      .fixed-header {
        .fixed-header-content {
          .right-section {
            .ant-btn:not(.ant-btn-primary) {
              display: none;
            }
          }
        }
      }
    }
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
