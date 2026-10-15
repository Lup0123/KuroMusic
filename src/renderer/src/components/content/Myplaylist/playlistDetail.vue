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
          <n-button
            circle
            :disabled="favoriteDisabled"
            :loading="isFavoriteUpdating"
            :title="favoriteTitle"
            :aria-label="favoriteTitle"
            @click="toggleFavorite"
          >
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
              <n-button
                size="large"
                round
                :disabled="favoriteDisabled"
                :loading="isFavoriteUpdating"
                :title="favoriteTitle"
                @click="toggleFavorite"
              >
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
              :class="{
                active: currentSong?.id === item.song.id,
                selected: isSelected(item.song)
              }"
              :style="{ transform: `translateY(${item.row.start - listScrollMargin}px)` }"
              @click="onRowClick($event, item.song, item.row.index)"
              @dblclick="playSong(item.song, item.row.index)"
              @contextmenu.prevent="openMenu($event, item.song, item.row.index)"
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
                  :class="{ liked: playlistStore.isSongLiked(item.song.id) }"
                  @click.stop="toggleLike(item.song)"
                >
                  <n-icon
                    ><Heart v-if="playlistStore.isSongLiked(item.song.id)" /><HeartOutline v-else
                  /></n-icon>
                </div>
              </div>

              <div class="col-duration"><SongDurationText :song="item.song" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单：多选时批量操作 -->
    <div
      v-if="menu.visible"
      class="context-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="menuAction('play')">
        <n-icon><PlaySharp /></n-icon><span>播放</span>
      </div>
      <div class="menu-item" @click="menuAction('playNext')">
        <n-icon><PlaySkipForwardOutline /></n-icon>
        <span>下一首播放{{ selectionSuffix }}</span>
      </div>
      <div class="menu-item" @click="menuAction('addToPlaylist')">
        <n-icon><FolderOpenOutline /></n-icon>
        <span>添加到歌单{{ selectionSuffix }}</span>
      </div>
      <div class="menu-item" @click="menuAction('download')">
        <n-icon><DownloadOutline /></n-icon>
        <span>下载{{ selectionSuffix }}</span>
      </div>
      <div v-if="playlist.isLocal" class="menu-item danger" @click="menuAction('delete')">
        <n-icon><TrashOutline /></n-icon>
        <span>从歌单中删除{{ selectionSuffix }}</span>
      </div>
    </div>
    <div
      v-if="menu.visible"
      class="context-mask"
      @click="closeMenu"
      @contextmenu.prevent="closeMenu"
    ></div>

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
import { ref, reactive, onMounted, onBeforeUnmount, toRaw, watch, computed, nextTick } from 'vue'
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
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { formatDate } from '@/utils/utils'
import { downloadSong, downloadSongs } from '@/utils/downloadUtils'
import { goBackOrHome } from '@/router/navHistory'
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
const { isLoggedIn } = storeToRefs(useUserStore())

// 歌单信息
const playlist = ref({
  id: currentPlaylistInfo.value.id,
  name: currentPlaylistInfo.value.name,
  cover: currentPlaylistInfo.value.cover || '',
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
const songsToAdd = ref([])

// 收藏状态：登录后以网易云收藏为准（与手机端互通），未登录时退回本地收藏
const isFavoriteUpdating = ref(false)
const isFavorited = computed(() => {
  if (playlist.value.isLocal) return false
  if (isLoggedIn.value) return playlistStore.isPlaylistSubscribed(playlist.value.id)
  return playlistStore.favoritePlaylists.some((p) => String(p.id) === String(playlist.value.id))
})
const isOwnPlaylist = computed(
  () => isLoggedIn.value && playlistStore.isOwnCloudPlaylist(playlist.value.id)
)
const favoriteDisabled = computed(() => playlist.value.isLocal || isOwnPlaylist.value)
const favoriteTitle = computed(() => {
  if (playlist.value.isLocal) return '本地歌单无需收藏'
  if (isOwnPlaylist.value) return '自己创建的歌单无需收藏'
  return isFavorited.value ? '取消收藏' : '收藏歌单'
})

// 多选：单击选中，Ctrl/Cmd 切换，Shift 范围选择
const selectedIds = ref(new Set())
let lastClickedIndex = -1
const idKey = (id) => String(id ?? '')
const isSelected = (song) => selectedIds.value.has(idKey(song.id))
// 按列表顺序返回选中的歌曲
const selectedSongs = () => songs.value.filter((s) => selectedIds.value.has(idKey(s.id)))
const selectionSuffix = computed(() =>
  selectedIds.value.size > 1 ? ` (${selectedIds.value.size})` : ''
)
const clearSelection = () => {
  selectedIds.value = new Set()
  lastClickedIndex = -1
}

const onRowClick = (event, song, index) => {
  const key = idKey(song.id)
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedIds.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedIds.value = next
    lastClickedIndex = index
  } else if (event.shiftKey && lastClickedIndex >= 0) {
    const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b)
    const next = new Set(selectedIds.value)
    for (let i = start; i <= end; i++) next.add(idKey(songs.value[i]?.id))
    selectedIds.value = next
  } else {
    selectedIds.value = new Set([key])
    lastClickedIndex = index
  }
}

// 右键菜单
const menu = reactive({ visible: false, x: 0, y: 0, song: null, index: -1 })
const MENU_SIZE = { width: 200, height: 230 }

const openMenu = (event, song, index) => {
  // 右键未选中的歌曲时，只操作这一首
  if (!isSelected(song)) {
    selectedIds.value = new Set([idKey(song.id)])
    lastClickedIndex = index
  }
  menu.song = song
  menu.index = index
  menu.x = Math.min(event.clientX, window.innerWidth - MENU_SIZE.width)
  menu.y = Math.min(event.clientY, window.innerHeight - MENU_SIZE.height)
  menu.visible = true
}

const closeMenu = () => {
  menu.visible = false
}

const menuAction = async (action) => {
  const target = menu.song
  const targetIndex = menu.index
  closeMenu()
  const list = selectedSongs()
  const batch = list.length > 0 ? list : target ? [target] : []
  if (batch.length === 0) return

  if (action === 'play') {
    if (target) playSong(target, targetIndex)
  } else if (action === 'playNext') {
    // 逆序插入，保证播放顺序与列表顺序一致
    for (const song of [...batch].reverse()) songStore.playSongNext(song)
    feedback.success(`已添加 ${batch.length} 首到下一首播放`)
  } else if (action === 'addToPlaylist') {
    openAddToPlaylist(batch)
  } else if (action === 'download') {
    await downloadSongs(batch)
  } else if (action === 'delete') {
    deleteSongsFromPlaylist(batch)
  }
}

const handleGlobalKeydown = (event) => {
  if (event.key !== 'Escape') return
  if (menu.visible) closeMenu()
  else clearSelection()
}
const handleGlobalClick = () => {
  if (menu.visible) closeMenu()
}

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
  goBackOrHome(router)
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
  const newLikedState = !playlistStore.isSongLiked(song.id)

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

// 从歌单中删除歌曲（支持多首）
const deleteSongsFromPlaylist = (list) => {
  if (list.length === 0) return
  dialog.warning({
    title: '确认删除',
    content:
      list.length > 1
        ? `确定要从歌单中删除选中的 ${list.length} 首歌曲吗？`
        : `确定要从歌单中删除「${list[0].name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const removed = new Set()
        for (const song of list) {
          if (await playlistStore.removeSongFromLocalPlaylist(playlist.value.id, song.id)) {
            removed.add(song.id)
          }
        }
        if (removed.size === 0) {
          feedback.error('删除失败')
          return
        }
        songs.value = songs.value.filter((s) => !removed.has(s.id))
        if (songs.value.length > 0 && songs.value[0].cover) {
          playlist.value.cover = songs.value[0].cover
        }
        clearSelection()
        feedback.success(
          removed.size === list.length
            ? `已删除 ${removed.size} 首`
            : `已删除 ${removed.size} 首，${list.length - removed.size} 首删除失败`
        )
        await playlistStore.loadLocalPlaylists()
      } catch (error) {
        console.error('删除歌曲失败:', error)
        feedback.errorWith(error, '删除失败，请稍后重试')
      }
    }
  })
}

const deleteSongFromPlaylist = (song) => deleteSongsFromPlaylist([song])

const openAddToPlaylist = (list) => {
  songsToAdd.value = list
  selectedPlaylistId.value = null
  addToPlaylistModalVisible.value = true
}

const addToPlaylist = (song) => openAddToPlaylist([song])

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

  if (songsToAdd.value.length === 0) {
    feedback.error('没有选择要添加的歌曲')
    return false
  }

  try {
    const playlistId = selectedPlaylistId.value
    let added = 0
    for (const song of songsToAdd.value) {
      if (await playlistStore.addSongToLocalPlaylist(playlistId, toRaw(song))) added++
    }
    const total = songsToAdd.value.length

    if (added === 0) {
      feedback.warning(total > 1 ? '所选歌曲都已在该歌单中' : '歌曲已存在于该歌单中')
      return false
    }
    feedback.success(
      added === total ? `已添加 ${added} 首` : `已添加 ${added} 首，${total - added} 首已存在`
    )
    await playlistStore.loadLocalPlaylists()
    songsToAdd.value = []
    selectedPlaylistId.value = null
    addToPlaylistModalVisible.value = false
    return true
  } catch (error) {
    console.error('添加歌曲到歌单失败:', error)
    feedback.errorWith(error, '添加失败，请稍后重试')
    return false
  }
}

const handleCancelAddToPlaylist = () => {
  addToPlaylistModalVisible.value = false
  songsToAdd.value = []
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
    return firstSong.al?.picUrl || firstSong.cover || firstSong.albumCover || ''
  }
  return ''
}

const toggleFavorite = async () => {
  if (favoriteDisabled.value || isFavoriteUpdating.value) return
  const subscribe = !isFavorited.value
  isFavoriteUpdating.value = true
  try {
    if (isLoggedIn.value) {
      const result = await playlistStore.toggleSubscribePlaylist(
        { ...playlist.value, createTime: currentPlaylistInfo.value.createTime },
        subscribe
      )
      if (result.success) {
        feedback.success(subscribe ? '已收藏到网易云' : '已取消收藏')
      } else {
        feedback.error(result.message || (subscribe ? '收藏失败' : '取消收藏失败'))
      }
      return
    }

    // 未登录：本地收藏
    if (subscribe) {
      const success = await playlistStore.addToFavoritePlaylist({
        id: playlist.value.id,
        name: playlist.value.name,
        cover: playlist.value.cover,
        description: playlist.value.description,
        createTime: playlist.value.createTime,
        isLocal: false
      })
      if (success) feedback.success('已收藏到本地（登录后可收藏到网易云）')
      else feedback.warning('该歌单已收藏')
    } else {
      const success = await playlistStore.removeFromFavoritePlaylist(playlist.value.id)
      if (success) feedback.success('已取消收藏')
      else feedback.error('取消收藏失败')
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    feedback.error('操作失败')
  } finally {
    isFavoriteUpdating.value = false
  }
}

const loadPlaylistData = async () => {
  if (!currentPlaylistInfo.value.id) return

  isLoading.value = true
  clearSelection()
  closeMenu()
  const loadStartTime = performance.now()

  // 后台同步云端喜欢状态（心形直接读 store，刷新完成后自动更新）
  void playlistStore.refreshLikedSongs()

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
      const localPlaylist = await window.api.getPlaylistById(playlist.value.id)
      if (localPlaylist && localPlaylist.songs) {
        songs.value = localPlaylist.songs.map((song) => playlistStore.normalizeSong(song))
        playlistStore.setCurrentPlaylistSongs(songs.value)
        if (songs.value.length > 0 && songs.value[0].cover) {
          playlist.value.cover = songs.value[0].cover
        } else if (!playlist.value.cover) {
          playlist.value.cover = ''
        }
      }
    } else {
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
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handleGlobalClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateListScrollMargin)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handleGlobalClick)
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
        transition: background-color 0.15s ease;
        cursor: default;
        user-select: none;

        &:hover {
          background: color-mix(
            in srgb,
            var(--primary-color, var(--n-primary-color)) 12%,
            transparent
          );

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

        // 选中：主色底 + 左侧色条
        &.selected {
          background: color-mix(
            in srgb,
            var(--primary-color, var(--n-primary-color)) 28%,
            transparent
          );

          &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 60%;
            border-radius: 0 3px 3px 0;
            background: var(--primary-color, var(--n-primary-color));
          }

          .song-name {
            color: var(--primary-color, var(--n-primary-color));
            font-weight: 600;
          }

          &:hover {
            background: color-mix(
              in srgb,
              var(--primary-color, var(--n-primary-color)) 36%,
              transparent
            );
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
              color: var(--primary-color, var(--n-primary-color));
            }
          }
          .song-name {
            color: var(--primary-color, var(--n-primary-color)) !important;
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
              border: 1px solid var(--primary-color, var(--n-primary-color));
              color: var(--primary-color, var(--n-primary-color));
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
              color: var(--primary-color, var(--n-primary-color));
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
        background: var(--primary-color, var(--n-primary-color));
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
        background-color: color-mix(
          in srgb,
          var(--primary-color, var(--n-primary-color)) 16%,
          transparent
        );
        border: 1px solid var(--primary-color, var(--n-primary-color));
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
        color: var(--primary-color, var(--n-primary-color));
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

/* 右键菜单 */
.context-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.context-menu {
  position: fixed;
  z-index: 3001;
  min-width: 180px;
  padding: 4px;
  border-radius: 10px;
  background: var(--glass-panel-bg, var(--n-color-modal, #fff));
  backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--glass-panel-border, var(--n-border-color));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 7px;
    font-size: 13px;
    color: var(--n-text-color);
    cursor: pointer;

    &:hover {
      background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 12%, transparent);
    }

    &.danger {
      color: #f53f3f;
    }
  }
}
</style>
