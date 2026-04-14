<template>
  <div class="artist-detail-page">
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

    <div class="content-grid">
      <section class="section-card">
        <div class="section-head">
          <div class="section-title-wrap">
            <h3>热门单曲</h3>
            <span class="section-count">{{ hotSongs.length }} 首</span>
          </div>
          <n-button
            type="primary"
            secondary
            size="small"
            :disabled="hotSongs.length === 0"
            @click="playAllSongs"
          >
            播放全部
          </n-button>
        </div>

        <div v-if="loadingSongs" class="section-loading">
          <n-spin size="small" />
          <span>加载中...</span>
        </div>

        <n-empty v-else-if="hotSongs.length === 0" size="small" description="暂无热门单曲数据" />

        <div v-else class="song-list">
          <div
            v-for="(song, index) in hotSongs"
            :key="song.id"
            class="song-row"
            @dblclick="playSong(song)"
          >
            <span class="song-index">{{ index + 1 }}</span>
            <div class="song-main">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-sub">{{ song.album || '未知专辑' }}</div>
            </div>
            <span class="song-duration">{{ song.duration }}</span>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h3>热门专辑</h3>
          <span class="section-count">{{ albums.length }} 张</span>
        </div>

        <div v-if="loadingAlbums" class="section-loading">
          <n-spin size="small" />
          <span>加载中...</span>
        </div>

        <n-empty v-else-if="albums.length === 0" size="small" description="暂无专辑数据" />

        <div v-else class="album-list">
          <div v-for="album in albums" :key="album.id" class="album-row" @click="goToAlbum(album)">
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
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useSongStore } from '@/stores/songStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { ROUTE_NAMES } from '@/router/routeNames'
import AppCover from '@/components/common/AppCover.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const songStore = useSongStore()
const playlistStore = usePlaylistStore()

const loadingSongs = ref(false)
const loadingAlbums = ref(false)
const hotSongs = ref([])
const albums = ref([])

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

const formatCount = (value) => {
  const count = Number(value) || 0
  if (count >= 100000000) return `${(count / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `${count}`
}

const formatDuration = (ms) => {
  if (!ms) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const sec = String(totalSec % 60).padStart(2, '0')
  return `${min}:${sec}`
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
    message.error('加载热门单曲失败')
    hotSongs.value = []
  } finally {
    loadingSongs.value = false
  }
}

const loadAlbums = async () => {
  if (!artist.value.id) return
  loadingAlbums.value = true
  try {
    const res = await window.api.getArtistAlbums(artist.value.id, 20, 0)
    const resultAlbums = res?.body?.hotAlbums || []
    albums.value = resultAlbums.slice(0, 12).map((item) => ({
      id: item.id,
      name: item.name,
      cover: item.picUrl || artist.value.avatar,
      size: item.size || 0,
      publishTime: formatDate(item.publishTime)
    }))
  } catch (error) {
    console.error('加载歌手专辑失败:', error)
    message.error('加载专辑失败')
    albums.value = []
  } finally {
    loadingAlbums.value = false
  }
}

const playSong = async (song) => {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
    const quality = settings.quality || 'exhigh'
    const response = await window.api.getSongUrl(song.id, quality)
    const url = response?.body?.data?.[0]?.url
    if (!url) {
      message.warning('该歌曲暂时无法播放')
      return
    }

    songStore.play({ ...song, cover: song.albumCover || artist.value.avatar, url })
    message.success(`开始播放 ${song.name}`)
  } catch (error) {
    console.error('播放失败:', error)
    message.error('播放失败，请重试')
  }
}

const playAllSongs = () => {
  if (hotSongs.value.length === 0) {
    message.warning('暂无可播放歌曲')
    return
  }

  const normalizedSongs = hotSongs.value.map((song) => ({
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
  message.success(`开始播放 ${normalizedSongs.length} 首热门单曲`)
}

const goToAlbum = (album) => {
  if (!album?.id) return

  playlistStore.setCurrentPlaylist({
    id: album.id,
    name: album.name || '专辑',
    cover: album.cover || '',
    description: `歌手 ${artist.value.name || ''} 的热门专辑`,
    createTime: album.publishTime || '',
    isLocal: false
  })

  router.push({
    name: ROUTE_NAMES.PLAYLIST_DETAIL,
    params: { id: String(album.id) }
  })
}

onMounted(async () => {
  await Promise.all([loadHotSongs(), loadAlbums()])
})
</script>

<style scoped lang="scss">
.artist-detail-page {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
    background: var(--n-hover-color);
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
    background: var(--n-hover-color);
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
</style>
