<template>
  <div class="artist-detail-page">
    <!-- 返回 -->
    <div class="page-bar">
      <n-button text class="back-btn" aria-label="返回" @click="goBack">
        <template #icon>
          <n-icon size="20"><ArrowBackOutline /></n-icon>
        </template>
        返回
      </n-button>
    </div>

    <div class="artist-card">
      <div class="avatar-wrap">
        <n-avatar round :size="88" :src="artist.avatar">
          {{ artist.name?.slice(0, 1) || '艺' }}
        </n-avatar>
      </div>
      <div class="artist-info">
        <h2 class="artist-name">{{ artist.name || '未知歌手' }}</h2>
        <p v-if="artist.alias" class="artist-alias">{{ artist.alias }}</p>
        <div class="artist-stats">
          <span>粉丝 {{ formatCount(artist.fanCount) }}</span>
          <span>单曲 {{ artist.musicSize || 0 }}</span>
          <span>专辑 {{ artist.albumSize || 0 }}</span>
        </div>
      </div>
    </div>

    <div v-if="bio" class="bio-card">
      <h3>歌手简介</h3>
      <p class="bio-text" :class="{ expanded: bioExpanded }">{{ bio }}</p>
      <button
        v-if="bio.length > 90"
        type="button"
        class="bio-toggle"
        @click="bioExpanded = !bioExpanded"
      >
        {{ bioExpanded ? '收起' : '展开全部' }}
      </button>
    </div>

    <div class="content-grid">
      <section class="section-card">
        <div class="section-head">
          <div class="section-title-wrap">
            <h3>单曲</h3>
            <span class="section-count">{{
              songMode === 'hot' ? `${hotSongs.length} 首热门` : `共 ${allTotal} 首`
            }}</span>
          </div>
          <div class="head-actions">
            <n-radio-group :value="songMode" size="small" @update:value="onSongModeChange">
              <n-radio-button value="hot">热门</n-radio-button>
              <n-radio-button value="all">全部</n-radio-button>
            </n-radio-group>
            <n-button
              type="primary"
              secondary
              size="small"
              :disabled="displaySongs.length === 0"
              @click="playAllSongs"
            >
              播放全部
            </n-button>
          </div>
        </div>

        <div v-if="songMode === 'all'" class="order-bar">
          <n-radio-group :value="songOrder" size="small" @update:value="onOrderChange">
            <n-radio-button value="hot">按热度</n-radio-button>
            <n-radio-button value="time">按时间</n-radio-button>
          </n-radio-group>
        </div>

        <StateView
          :loading="songMode === 'hot' ? loadingSongs : loadingAllSongs && allSongs.length === 0"
          :empty="!loadingSongs && !loadingAllSongs && displaySongs.length === 0"
          empty-text="暂无歌曲数据"
        >
          <template #loading>
            <div class="section-loading">
              <n-spin size="small" />
              <span>加载中…</span>
            </div>
          </template>
          <div class="song-list">
            <div
              v-for="(song, index) in displaySongs"
              :key="song.id"
              class="song-row"
              :class="{ selected: isSelected(song) }"
              @click="onRowClick($event, song, index)"
              @dblclick="playSong(song)"
              @contextmenu.prevent="openMenu($event, song)"
            >
              <span class="song-index">{{ index + 1 }}</span>
              <div class="song-main">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-sub">{{ song.album || '未知专辑' }}</div>
              </div>
              <span class="song-duration"><SongDurationText :song="song" /></span>
            </div>
          </div>
          <div v-if="songMode === 'all' && allMore" class="load-more">
            <n-button size="small" :loading="loadingAllSongs" @click="loadMoreSongs">
              加载更多
            </n-button>
          </div>
        </StateView>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h3>专辑</h3>
          <span class="section-count">{{ albums.length }} 张</span>
        </div>

        <StateView
          :loading="loadingAlbums && albums.length === 0"
          :empty="!loadingAlbums && albums.length === 0"
          empty-text="暂无专辑数据"
        >
          <template #loading>
            <div class="section-loading">
              <n-spin size="small" />
              <span>加载中…</span>
            </div>
          </template>
          <div class="album-list">
            <div
              v-for="album in albums"
              :key="album.id"
              class="album-row"
              @click="goToAlbum(album)"
            >
              <AppCover :src="album.cover" :width="52" :height="52" :size="104" :radius="8" />
              <div class="album-main">
                <div class="album-name">{{ album.name }}</div>
                <div class="album-sub">
                  <span>{{ album.size }} 首</span>
                  <span>{{ album.publishTime }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="albumMore" class="load-more">
            <n-button size="small" :loading="loadingAlbums" @click="loadMoreAlbums">
              加载更多专辑
            </n-button>
          </div>
        </StateView>
      </section>
    </div>

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
  CheckmarkCircle,
  ArrowBackOutline
} from '@vicons/ionicons5'

const route = useRoute()
const router = useRouter()
const feedback = useAppFeedback()
const songStore = useSongStore()
const playlistStore = usePlaylistStore()
const { createdPlaylists } = storeToRefs(playlistStore)

// 多选 + 右键菜单
const selectedIds = ref(new Set())
let lastClickedIndex = -1
const menu = reactive({ visible: false, x: 0, y: 0, song: null })
const addToPlaylistVisible = ref(false)
const selectedPlaylistId = ref(null)
const pendingSongs = ref([])

const loadingSongs = ref(false)
const loadingAlbums = ref(false)
const hotSongs = ref([])
const albums = ref([])

// 全部歌曲（分页 + 排序）
const songMode = ref('hot') // 'hot' | 'all'
const songOrder = ref('hot') // 'hot' | 'time'
const allSongs = ref([])
const allTotal = ref(0)
const allMore = ref(false)
const allOffset = ref(0)
const loadingAllSongs = ref(false)
const ALL_SONGS_PAGE = 50

// 专辑分页
const albumOffset = ref(0)
const albumMore = ref(false)
const ALBUM_PAGE = 20

// 歌手简介
const bio = ref('')
const bioExpanded = ref(false)

const displaySongs = computed(() => (songMode.value === 'hot' ? hotSongs.value : allSongs.value))

const normalizeApiSong = (item) => ({
  id: item.id,
  name: item.name,
  artist: item.ar?.map((ar) => ar.name).join(' / ') || artist.value.name,
  album: item.al?.name || '',
  albumCover: item.al?.picUrl || artist.value.avatar,
  duration: formatDuration(item.dt),
  durationMs: item.dt
})

const artist = computed(() => {
  const query = route.query || {}
  return {
    id: route.params.id,
    name: query.name || '',
    alias: query.alias || '',
    avatar: query.avatar || '',
    fanCount: Number(query.fanCount) || 0,
    musicSize: Number(query.musicSize) || 0,
    albumSize: Number(query.albumSize) || 0
  }
})

const goBack = () => {
  goBackOrHome(router)
}

const formatCount = (value) => {
  const count = Number(value) || 0
  if (count >= 100000000) return `${(count / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `${count}`
}

const formatDate = (timestamp) => {
  if (!timestamp) return '未知时间'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '未知时间'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const loadHotSongs = async () => {
  if (!artist.value.id) return
  loadingSongs.value = true
  try {
    const res = await window.api.getArtistTopSongs(artist.value.id)
    const songs = res?.body?.songs || []
    hotSongs.value = songs.slice(0, 20).map((item) => ({
      id: item.id,
      name: item.name,
      artist: item.ar?.map((ar) => ar.name).join(' / ') || artist.value.name,
      album: item.al?.name || '',
      albumCover: item.al?.picUrl || artist.value.avatar,
      duration: formatDuration(item.dt),
      durationMs: item.dt
    }))
  } catch (error) {
    console.error('加载歌手热门单曲失败:', error)
    feedback.error('加载热门单曲失败')
    hotSongs.value = []
  } finally {
    loadingSongs.value = false
  }
}

const loadAlbums = async (reset = false) => {
  if (!artist.value.id) return
  if (reset) {
    albumOffset.value = 0
    albums.value = []
  }
  loadingAlbums.value = true
  try {
    const res = await window.api.getArtistAlbums(artist.value.id, ALBUM_PAGE, albumOffset.value)
    const resultAlbums = (res?.body?.hotAlbums || []).map((item) => ({
      id: item.id,
      name: item.name,
      cover: item.picUrl || artist.value.avatar,
      size: item.size || 0,
      publishTime: formatDate(item.publishTime)
    }))
    albums.value = reset ? resultAlbums : [...albums.value, ...resultAlbums]
    albumMore.value = Boolean(res?.body?.more)
    albumOffset.value += resultAlbums.length
  } catch (error) {
    console.error('加载歌手专辑失败:', error)
    feedback.error('加载专辑失败')
    if (reset) albums.value = []
  } finally {
    loadingAlbums.value = false
  }
}

const loadMoreAlbums = () => loadAlbums(false)

// 全部歌曲（分页 + 排序）
const loadAllSongs = async (reset = false) => {
  if (!artist.value.id) return
  if (reset) {
    allOffset.value = 0
    allSongs.value = []
  }
  loadingAllSongs.value = true
  try {
    const res = await window.api.getArtistSongs(
      artist.value.id,
      songOrder.value,
      allOffset.value,
      ALL_SONGS_PAGE
    )
    const songs = (res?.body?.songs || []).map(normalizeApiSong)
    allSongs.value = reset ? songs : [...allSongs.value, ...songs]
    allTotal.value = Number(res?.body?.total) || allSongs.value.length
    allMore.value = Boolean(res?.body?.more)
    allOffset.value += songs.length
  } catch (error) {
    console.error('加载歌手全部歌曲失败:', error)
    feedback.error('加载歌曲失败')
    if (reset) allSongs.value = []
  } finally {
    loadingAllSongs.value = false
  }
}

const onSongModeChange = (mode) => {
  songMode.value = mode
  if (mode === 'all' && allSongs.value.length === 0) loadAllSongs(true)
}

const onOrderChange = (order) => {
  songOrder.value = order
  loadAllSongs(true)
}

const loadMoreSongs = () => loadAllSongs(false)

// 歌手简介
const loadBio = async () => {
  if (!artist.value.id) return
  try {
    const res = await window.api.getArtistDesc(artist.value.id)
    bio.value = String(res?.body?.briefDesc || '').trim()
  } catch (error) {
    console.error('加载歌手简介失败:', error)
    bio.value = ''
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

    songStore.play({ ...song, cover: song.albumCover || artist.value.avatar, url })
    feedback.success(`开始播放 ${song.name}`)
  } catch (error) {
    console.error('播放失败:', error)
    feedback.error('播放失败，请重试')
  }
}

const playAllSongs = () => {
  const source = displaySongs.value
  if (source.length === 0) {
    feedback.warning('暂无可播放歌曲')
    return
  }

  const normalizedSongs = source.map((song) => ({
    id: song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    cover: song.albumCover || artist.value.avatar,
    duration: song.duration,
    dt: song.durationMs
  }))

  songStore.replacePlaylist(normalizedSongs)
  songStore.playFromIndex(0)
  feedback.success(`开始播放 ${normalizedSongs.length} 首歌曲`)
}

const goToAlbum = (album) => {
  if (!album?.id) return

  // 走专辑路由，不再复用歌单详情（歌单接口用专辑 id 会命中无关歌单）
  router.push({
    name: ROUTE_NAMES.ALBUM_DETAIL,
    params: { id: String(album.id) },
    query: {
      name: album.name || '',
      cover: album.cover || '',
      artist: artist.value.name || '',
      artistId: String(artist.value.id || ''),
      artistAvatar: artist.value.avatar || '',
      publishTime: album.publishTime || ''
    }
  })
}

// 统一用字符串 id 比较，避免 number/string 不匹配导致选中失效
const idKey = (id) => String(id ?? '')
// 用 computed 派生一个普通数组作为选中依据，保证模板在 Set 变更时重新渲染
const selectedKeys = computed(() => Array.from(selectedIds.value, idKey))
const isSelected = (song) => selectedKeys.value.includes(idKey(song.id))

// 单击：普通点击选中该行；ctrl/cmd 多选切换；shift 范围选择；点击空白清空
const onRowClick = (event, song, index) => {
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
    for (let i = start; i <= end; i++) next.add(idKey(displaySongs.value[i]?.id))
    selectedIds.value = next
  } else {
    // 普通单击：选中当前行（不清空其它，避免误清）
    selectedIds.value = new Set([idKey(song.id)])
    lastClickedIndex = index
  }
}

const openMenu = (event, song) => {
  if (!isSelected(song)) {
    selectedIds.value = new Set([idKey(song.id)])
  }
  menu.visible = true
  menu.song = song
  menu.x = Math.min(event.clientX, window.innerWidth - 180)
  menu.y = Math.min(event.clientY, window.innerHeight - 160)
}

const closeMenu = () => {
  menu.visible = false
}

const selectedSongs = () => displaySongs.value.filter((s) => isSelected(s))
const toPlayable = (song) => ({
  id: song.id,
  name: song.name,
  artist: song.artist,
  album: song.album,
  cover: song.albumCover || artist.value.avatar,
  duration: song.duration,
  dt: song.durationMs
})

const menuAction = (action) => {
  const target = menu.song
  closeMenu()

  if (action === 'play') {
    if (target) playSong(target)
  } else if (action === 'playNext') {
    const list = selectedIds.value.size > 1 ? selectedSongs() : target ? [target] : []
    for (const song of list) songStore.playSongNext(toPlayable(song))
    if (list.length) feedback.success(`已添加 ${list.length} 首到下一首播放`)
  } else if (action === 'addToPlaylist') {
    pendingSongs.value = selectedIds.value.size > 0 ? selectedSongs() : target ? [target] : []
    if (pendingSongs.value.length === 0) return
    selectedPlaylistId.value = null
    addToPlaylistVisible.value = true
  }
}

const handleAddToPlaylist = async () => {
  if (!selectedPlaylistId.value) {
    feedback.warning('请选择一个歌单')
    return false
  }
  let successCount = 0
  for (const song of pendingSongs.value) {
    const ok = await playlistStore.addSongToLocalPlaylist(
      selectedPlaylistId.value,
      toPlayable(song)
    )
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

const onGlobalClick = () => {
  if (menu.visible) closeMenu()
}
const onGlobalKeydown = (e) => {
  if (e.key === 'Escape') closeMenu()
}

onMounted(async () => {
  await Promise.all([loadHotSongs(), loadAlbums(true), loadBio()])
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped lang="scss">
.artist-detail-page {
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

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.section-card {
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-card-color);
  padding: 14px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 18px;
  }
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-count {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.section-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 12%, transparent);
  }
}

.song-index {
  width: 24px;
  text-align: center;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.song-main {
  flex: 1;
  min-width: 0;
}

.song-name,
.album-name {
  font-size: 14px;
  color: var(--n-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-sub,
.album-sub,
.song-duration {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.album-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.album-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 12%, transparent);
  }
}

.album-main {
  min-width: 0;
  flex: 1;
}

.album-sub {
  display: flex;
  gap: 8px;
}

.artist-card {
  display: flex;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-card-color);
}

.artist-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.artist-name {
  margin: 0;
  font-size: 26px;
  line-height: 1.2;
}

.artist-alias {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.artist-stats {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--n-text-color-2);
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* 歌手简介 */
.bio-card {
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-card-color);
  padding: 14px 16px;

  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }

  .bio-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--n-text-color-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &.expanded {
      -webkit-line-clamp: unset;
      line-clamp: unset;
    }
  }

  .bio-toggle {
    margin-top: 6px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--primary-color, var(--n-primary-color));
    font-size: 12px;
    cursor: pointer;
  }
}

/* 歌曲区头部操作 + 排序 + 加载更多 */
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.order-bar {
  margin-bottom: 10px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

/* 多选高亮 */
.song-row {
  position: relative;
  user-select: none;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &.selected {
    background: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 28%, transparent);

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
