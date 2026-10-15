<template>
  <div class="album-detail-page">
    <!-- 返回 -->
    <div class="page-bar">
      <n-button text class="back-btn" aria-label="返回" @click="goBack">
        <template #icon>
          <n-icon size="20"><ArrowBackOutline /></n-icon>
        </template>
        返回
      </n-button>
    </div>

    <!-- 专辑头部 -->
    <div class="album-head">
      <AppCover :src="album.cover" :width="180" :height="180" :size="360" :radius="12" />
      <div class="album-meta">
        <h2 class="album-name">{{ album.name || '未知专辑' }}</h2>
        <div class="album-artist" @click="goToArtist">
          <n-avatar round :size="24" :src="album.artistAvatar" />
          <span>{{ album.artist || '未知歌手' }}</span>
        </div>
        <div class="album-sub">
          <span v-if="album.publishTime">发行 {{ album.publishTime }}</span>
          <span>{{ songs.length }} 首</span>
        </div>
        <p v-if="album.description" class="album-desc">{{ album.description }}</p>
        <div class="album-actions">
          <n-button
            type="primary"
            secondary
            size="small"
            :disabled="songs.length === 0"
            @click="playAll"
          >
            播放全部
          </n-button>
        </div>
      </div>
    </div>

    <!-- 曲目列表 -->
    <StateView :loading="loading" :empty="!loading && songs.length === 0" empty-text="暂无曲目数据">
      <template #loading>
        <div class="section-loading">
          <n-spin size="small" />
          <span>加载中…</span>
        </div>
      </template>
      <div class="song-list">
        <div
          v-for="(song, index) in songs"
          :key="song.id"
          class="song-row"
          :class="{ selected: isSelected(song) }"
          @click="onRowClick($event, song)"
          @dblclick="playSong(song)"
          @contextmenu.prevent="openMenu($event, song)"
        >
          <span class="song-index">{{ index + 1 }}</span>
          <div class="song-main">
            <div class="song-name">{{ song.name }}</div>
            <div class="song-sub">{{ song.artist }}</div>
          </div>
          <span class="song-duration"><SongDurationText :song="song" /></span>
        </div>
      </div>
    </StateView>

    <!-- 右键菜单 -->
    <div
      v-if="menu.visible"
      class="context-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="menuAction('play')">
        <n-icon><PlayOutline /></n-icon><span>播放</span>
      </div>
      <div class="menu-item" @click="menuAction('playNext')">
        <n-icon><PlaySkipForwardOutline /></n-icon><span>下一首播放</span>
      </div>
      <div class="menu-item" @click="menuAction('addToPlaylist')">
        <n-icon><AddCircleOutline /></n-icon>
        <span>添加到歌单{{ selectedIds.size > 1 ? ` (${selectedIds.size})` : '' }}</span>
      </div>
      <div v-if="menu.song && menu.song.albumId" class="menu-item" @click="menuAction('goAlbum')">
        <n-icon><DiscOutline /></n-icon><span>查看专辑</span>
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
      v-model:show="addToPlaylistVisible"
      preset="dialog"
      title="添加到歌单"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleAddToPlaylist"
      @negative-click="cancelAddToPlaylist"
    >
      <div class="playlist-selection">
        <div class="playlist-list">
          <div
            v-for="pl in createdPlaylists"
            :key="pl.id"
            class="playlist-option"
            :class="{ selected: selectedPlaylistId === pl.id }"
            @click="selectedPlaylistId = pl.id"
          >
            <div class="playlist-name">{{ pl.name }}</div>
            <div class="playlist-count">{{ pl.songs?.length || 0 }} 首</div>
            <n-icon v-if="selectedPlaylistId === pl.id" class="check-icon" size="18">
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
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSongStore } from '@/stores/songStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { storeToRefs } from 'pinia'
import { ROUTE_NAMES } from '@/router/routeNames'
import { goBackOrHome } from '@/router/navHistory'
import AppCover from '@/components/common/AppCover.vue'
import SongDurationText from '@/components/common/SongDurationText.vue'
import StateView from '@/components/common/StateView.vue'
import { useAppFeedback } from '@/composables/useAppFeedback'
import { formatDuration } from '@/utils/utils'
import {
  PlayOutline,
  PlaySkipForwardOutline,
  AddCircleOutline,
  DiscOutline,
  CheckmarkCircle,
  ArrowBackOutline
} from '@vicons/ionicons5'

const route = useRoute()
const router = useRouter()
const feedback = useAppFeedback()
const songStore = useSongStore()
const playlistStore = usePlaylistStore()
const { createdPlaylists } = storeToRefs(playlistStore)

const loading = ref(false)
const songs = ref([])
const album = reactive({
  id: route.params.id,
  name: route.query.name || '',
  cover: route.query.cover || '',
  artist: route.query.artist || '',
  artistId: route.query.artistId || '',
  artistAvatar: route.query.artistAvatar || '',
  publishTime: route.query.publishTime || '',
  description: ''
})

// 多选
const selectedIds = ref(new Set())
let lastClickedIndex = -1

// 右键菜单
const menu = reactive({ visible: false, x: 0, y: 0, song: null })
const addToPlaylistVisible = ref(false)
const selectedPlaylistId = ref(null)
const pendingSongs = ref([])

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

const normalizeSong = (item) => ({
  id: item.id,
  name: item.name,
  artist: item.ar?.map((ar) => ar.name).join(' / ') || album.artist,
  album: item.al?.name || album.name,
  albumId: item.al?.id || album.id,
  albumCover: item.al?.picUrl || album.cover,
  duration: formatDuration(item.dt),
  durationMs: item.dt
})

const loadAlbum = async () => {
  if (!album.id) return
  loading.value = true
  try {
    const res = await window.api.getAlbumDetail(album.id)
    const body = res?.body || {}
    const albumData = body.album || {}
    album.name = albumData.name || album.name
    album.cover = albumData.picUrl || album.cover
    album.artist = albumData.artist?.name || album.artist
    album.artistId = albumData.artist?.id || album.artistId
    album.publishTime = formatDate(albumData.publishTime) || album.publishTime
    album.description = String(albumData.description || '').trim()
    songs.value = (body.songs || []).map(normalizeSong)
  } catch (error) {
    console.error('加载专辑详情失败:', error)
    feedback.error('加载专辑失败')
    songs.value = []
  } finally {
    loading.value = false
  }
}

const playSong = async (song) => {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
    const quality = settings.quality || 'exhigh'
    const response = await window.api.getSongUrl(song.id, quality)
    const url = response?.body?.data?.[0]?.url
    if (!url) {
      feedback.warning('该歌曲暂时无法播放')
      return
    }
    songStore.play({ ...song, cover: song.albumCover || album.cover, url })
    feedback.success(`开始播放 ${song.name}`)
  } catch (error) {
    console.error('播放失败:', error)
    feedback.error('播放失败，请重试')
  }
}

const playAll = () => {
  if (songs.value.length === 0) {
    feedback.warning('暂无可播放歌曲')
    return
  }
  const normalized = songs.value.map((song) => ({
    id: song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    cover: song.albumCover || album.cover,
    duration: song.duration,
    dt: song.durationMs
  }))
  songStore.replacePlaylist(normalized)
  songStore.playFromIndex(0)
  feedback.success(`开始播放 ${normalized.length} 首歌曲`)
}

const goBack = () => {
  goBackOrHome(router)
}

const goToArtist = () => {
  if (!album.artistId) return
  router.push({
    name: ROUTE_NAMES.ARTIST_DETAIL,
    params: { id: String(album.artistId) },
    query: { name: album.artist, avatar: album.artistAvatar }
  })
}

// 统一字符串 id 比较，避免 number/string 不匹配
const idKey = (id) => String(id ?? '')
// computed 派生普通数组，保证 Set 变更时模板重新渲染
const selectedKeys = computed(() => Array.from(selectedIds.value, idKey))
const isSelected = (song) => selectedKeys.value.includes(idKey(song.id))

// 单击：ctrl/cmd 切换选中，shift 范围选择，普通点击清空
const onRowClick = (event, song) => {
  const index = songs.value.findIndex((s) => String(s.id) === String(song.id))
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedIds.value)
    const key = idKey(song.id)
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
    // 普通单击：选中当前行
    selectedIds.value = new Set([idKey(song.id)])
    lastClickedIndex = index
  }
}

const openMenu = (event, song) => {
  // 右键的歌曲若不在选中集内，则只操作该曲
  if (!isSelected(song)) {
    selectedIds.value = new Set([idKey(song.id)])
  }
  menu.visible = true
  menu.song = song
  const MENU_W = 180
  const MENU_H = 190
  menu.x = Math.min(event.clientX, window.innerWidth - MENU_W)
  menu.y = Math.min(event.clientY, window.innerHeight - MENU_H)
}

const closeMenu = () => {
  menu.visible = false
}

const selectedSongs = () => songs.value.filter((s) => isSelected(s))

const menuAction = async (action) => {
  const target = menu.song
  closeMenu()

  if (action === 'play') {
    if (target) playSong(target)
  } else if (action === 'playNext') {
    const list = selectedIds.value.size > 1 ? selectedSongs() : target ? [target] : []
    for (const song of list) {
      songStore.playSongNext({
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.albumCover || album.cover,
        duration: song.duration,
        dt: song.durationMs
      })
    }
    if (list.length) feedback.success(`已添加 ${list.length} 首到下一首播放`)
  } else if (action === 'addToPlaylist') {
    pendingSongs.value = selectedIds.value.size > 0 ? selectedSongs() : target ? [target] : []
    if (pendingSongs.value.length === 0) return
    selectedPlaylistId.value = null
    addToPlaylistVisible.value = true
  } else if (action === 'goAlbum') {
    // 已在专辑页，指向同专辑无需跳转
    if (target?.albumId && String(target.albumId) !== String(album.id)) {
      router.push({ name: ROUTE_NAMES.ALBUM_DETAIL, params: { id: String(target.albumId) } })
    }
  }
}

const handleAddToPlaylist = async () => {
  if (!selectedPlaylistId.value) {
    feedback.warning('请选择一个歌单')
    return false
  }
  let successCount = 0
  for (const song of pendingSongs.value) {
    const ok = await playlistStore.addSongToLocalPlaylist(selectedPlaylistId.value, {
      id: song.id,
      name: song.name,
      artist: song.artist,
      album: song.album,
      cover: song.albumCover || album.cover,
      duration: song.duration,
      dt: song.durationMs
    })
    if (ok) successCount++
  }
  feedback.success(`成功添加 ${successCount} 首到歌单`)
  await playlistStore.loadLocalPlaylists()
  pendingSongs.value = []
  selectedPlaylistId.value = null
  selectedIds.value = new Set()
  addToPlaylistVisible.value = false
  return true
}

const cancelAddToPlaylist = () => {
  pendingSongs.value = []
  selectedPlaylistId.value = null
  addToPlaylistVisible.value = false
}

// 点击别处关闭右键菜单 / Esc 关闭
const onGlobalKeydown = (e) => {
  if (e.key === 'Escape') closeMenu()
}
const onGlobalClick = () => {
  if (menu.visible) closeMenu()
}

onMounted(async () => {
  await loadAlbum()
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped lang="scss">
.album-detail-page {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-bar {
  display: flex;
  align-items: center;

  .back-btn {
    color: var(--n-text-color-3);

    &:hover {
      color: var(--primary-color, var(--n-primary-color));
    }
  }
}

.album-head {
  display: flex;
  gap: 24px;
  align-items: flex-start;

  .album-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .album-name {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }

  .album-artist {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--n-text-color-2);
    cursor: pointer;
    width: fit-content;

    &:hover {
      color: var(--primary-color, var(--n-primary-color));
    }
  }

  .album-sub {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--n-text-color-3);
  }

  .album-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--n-text-color-3);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .album-actions {
    margin-top: 4px;
  }
}

.song-list {
  display: flex;
  flex-direction: column;
}

.song-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 12%, transparent);
  }

  &.selected {
    background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 28%, transparent);

    /* 左侧主色条，强化辨识 */
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

    .song-name,
    .song-index {
      color: var(--primary-color, var(--n-primary-color));
      font-weight: 600;
    }

    &:hover {
      background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 36%, transparent);
    }
  }

  .song-index {
    width: 40px;
    text-align: center;
    font-size: 13px;
    color: var(--n-text-color-3);
    flex-shrink: 0;
  }

  .song-main {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .song-name {
      font-size: 14px;
      color: var(--n-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-sub {
      font-size: 12px;
      color: var(--n-text-color-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .song-duration {
    font-size: 13px;
    color: var(--n-text-color-3);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
}

.section-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--n-text-color-3);
  font-size: 13px;
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
  min-width: 160px;
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
  }
}

/* 添加到歌单 */
.playlist-list {
  max-height: 320px;
  overflow-y: auto;

  .playlist-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;

    &:hover {
      background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 12%, transparent);
    }

    &.selected {
      background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 16%, transparent);
    }

    .playlist-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .playlist-count {
      font-size: 12px;
      color: var(--n-text-color-3);
    }

    .check-icon {
      color: var(--primary-color, var(--n-primary-color));
    }
  }
}
</style>
