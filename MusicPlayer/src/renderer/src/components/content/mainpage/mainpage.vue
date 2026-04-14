<template>
  <div class="mainpage">
    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-container">
      <n-spin size="large" />
      <p class="loading-text">正在加载内容...</p>
    </div>

    <div v-else class="mainpage-content">
      <!-- 私人FM（仅登录用户） -->
      <div v-if="isLoggedIn && fmSong" class="section fm-section">
        <div class="section-header">
          <h2 class="section-title">
            <span style="color: #ff6b6b">@</span>
            私人FM
          </h2>
          <p class="section-subtitle">根据你的口味智能推荐</p>
        </div>
        <div class="fm-card">
          <div class="fm-cover">
            <AppCover :src="fmSong.cover" :size="220" />
            <div class="fm-playing-indicator" :class="{ active: isCurrentFmPlaying }">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="fm-info">
            <h3 class="fm-title">{{ fmSong.name }}</h3>
            <p class="fm-artist">{{ fmSong.artist }}</p>
            <p class="fm-album">{{ fmSong.album }}</p>
            <p class="fm-duration">{{ formatDuration(fmSong.duration) }}</p>
            <div class="fm-actions">
              <n-button type="primary" circle size="large" @click="playFmSong">
                <template #icon>
                  <n-icon size="20">
                    <PauseOutline v-if="isCurrentFmPlaying" />
                    <PlayOutline v-else />
                  </n-icon>
                </template>
              </n-button>
              <n-button circle size="large" @click="nextFmSong">
                <template #icon
                  ><n-icon size="18"><PlaySkipForwardOutline /></n-icon
                ></template>
              </n-button>
              <n-button circle size="large" @click="trashFmSong">
                <template #icon
                  ><n-icon size="16"><ThumbsDownOutline /></n-icon
                ></template>
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 每日推荐歌曲（仅登录用户） -->
      <div v-if="isLoggedIn && recommendSongs.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#6366f1"><CalendarOutline /></n-icon>
            每日推荐歌曲
          </h2>
          <p class="section-subtitle">每日更新，根据你的音乐口味推荐</p>
        </div>
        <div class="songs-scroll-container">
          <n-scrollbar
            class="songs-scrollbar"
            x-scrollable
            trigger="hover"
            :horizontal-rail-style="{ background: 'transparent' }"
          >
            <div class="songs-scroll">
              <div
                v-for="song in recommendSongs"
                :key="'song-' + song.id"
                class="song-card"
                @click="playSong(song)"
              >
                <div class="song-cover">
                  <AppCover :src="song.cover" :size="80" />
                  <div class="play-overlay">
                    <n-icon size="24"><PlayOutline /></n-icon>
                  </div>
                </div>
                <div class="song-info">
                  <h4>{{ song.name }}</h4>
                  <p>{{ song.artist }}</p>
                </div>
              </div>
            </div>
          </n-scrollbar>
        </div>
      </div>

      <!-- 新歌速递（所有用户） -->
      <div v-if="topSongs.length > 0" class="section new-songs-section">
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#f59e0b"><HappyOutline /></n-icon>
            新歌速递
          </h2>
          <p class="section-subtitle">最新发布的热门歌曲</p>
        </div>
        <div class="new-songs-tabs">
          <span
            v-for="tab in topSongsTabs"
            :key="tab.value"
            :class="['tab-item', { active: topSongsType === tab.value }]"
            @click="changeTopSongsType(tab.value)"
          >
            {{ tab.label }}
          </span>
        </div>
        <div class="new-songs-list">
          <div
            v-for="(song, index) in topSongs.slice(0, 10)"
            :key="'new-' + song.id"
            class="new-song-item"
            @click="playSong(song)"
          >
            <span class="song-index" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <div class="song-cover-small">
              <AppCover :src="song.cover" :size="60" />
            </div>
            <div class="song-detail">
              <h4>{{ song.name }}</h4>
              <p>{{ song.artist }} · {{ song.album }}</p>
            </div>
            <span class="song-duration">{{ formatDuration(song.duration) }}</span>
          </div>
        </div>
      </div>

      <!-- 每日推荐歌单（仅登录用户） -->
      <div v-if="isLoggedIn && recommendPlaylists.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ff6b6b"><FlameOutline /></n-icon>
            每日推荐歌单
          </h2>
          <p class="section-subtitle">根据你的音乐口味为你推荐</p>
        </div>
        <div class="playlist-grid">
          <div
            v-for="playlist in recommendPlaylists"
            :key="'rec-' + playlist.id"
            class="playlist-card"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <AppCover :src="playlist.cover" :size="240" />
              <div class="play-overlay">
                <n-button type="primary" circle size="large"
                  ><template #icon
                    ><n-icon size="24"><PlayOutline /></n-icon></template
                ></n-button>
              </div>
              <div class="recommend-badge">每日推荐</div>
            </div>
            <div class="playlist-info">
              <h4>{{ playlist.name }}</h4>
              <p class="play-count">{{ formatPlayCount(playlist.playCount) }} 次播放</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 个性化推荐歌单 -->
      <div v-if="personalizedPlaylists.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ffd93d"><StarOutline /></n-icon>
            {{ isLoggedIn ? '为你推荐' : '精选歌单' }}
          </h2>
          <p class="section-subtitle">发现更多好音乐</p>
        </div>
        <div class="playlist-grid">
          <div
            v-for="playlist in personalizedPlaylists"
            :key="'per-' + playlist.id"
            class="playlist-card"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <AppCover :src="playlist.cover" :size="240" />
              <div class="play-overlay">
                <n-button type="primary" circle size="large"
                  ><template #icon
                    ><n-icon size="24"><PlayOutline /></n-icon></template
                ></n-button>
              </div>
            </div>
            <div class="playlist-info">
              <h4>{{ playlist.name }}</h4>
              <p class="play-count">{{ formatPlayCount(playlist.playCount) }} 次播放</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="topPlaylists.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ff6b6b"><FlameOutline /></n-icon>
            热门歌单
          </h2>
          <p class="section-subtitle">最受欢迎的精选歌单</p>
        </div>
        <div class="playlist-grid">
          <div
            v-for="playlist in topPlaylists"
            :key="'top-' + playlist.id"
            class="playlist-card"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <AppCover :src="playlist.cover" :size="240" />
              <div class="play-overlay">
                <n-button type="primary" circle size="large"
                  ><template #icon
                    ><n-icon size="24"><PlayOutline /></n-icon></template
                ></n-button>
              </div>
            </div>
            <div class="playlist-info">
              <h4>{{ playlist.name }}</h4>
              <p class="play-count">{{ formatPlayCount(playlist.playCount) }} 次播放</p>
              <p class="description">{{ playlist.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  PlayOutline,
  PauseOutline,
  PlaySkipForwardOutline,
  ThumbsDownOutline,
  CalendarOutline,
  HappyOutline,
  FlameOutline,
  StarOutline
} from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useUserStore } from '@/stores/userStore'
import { useSongStore } from '@/stores/songStore'
import { ROUTE_NAMES } from '@/router/routeNames'
import AppCover from '@/components/common/AppCover.vue'

const router = useRouter()
const message = useMessage()
const playlistStore = usePlaylistStore()
const { setCurrentPlaylist } = playlistStore
const userStore = useUserStore()
const { isLoggedIn } = storeToRefs(userStore)
const songStore = useSongStore()
const { currentSong, isPlaying } = storeToRefs(songStore)

const recommendPlaylists = ref([])
const personalizedPlaylists = ref([])
const topPlaylists = ref([])
const recommendSongs = ref([])
const fmSongs = ref([])
const fmSong = ref(null)
const topSongs = ref([])
const topSongsType = ref(0)
const loading = ref(true)

const topSongsTabs = [
  { label: '全部', value: 0 },
  { label: '华语', value: 7 },
  { label: '欧美', value: 96 },
  { label: '日本', value: 8 },
  { label: '韩国', value: 16 }
]

const isCurrentFmPlaying = computed(() => {
  if (!fmSong.value || !currentSong.value) return false
  return currentSong.value.id === fmSong.value.id && isPlaying.value
})

const formatPlayCount = (count) => {
  if (!count) return '0'
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return count.toString()
}

const formatDuration = (ms) => {
  if (!ms) return '0:00'
  const seconds = Math.floor(ms / 1000)
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const gotodetail = async (playlist) => {
  setCurrentPlaylist(playlist)
  router.push({ name: ROUTE_NAMES.PLAYLIST_DETAIL, params: { id: String(playlist.id) } })
}

const playSong = async (song) => {
  try {
    const response = await window.api.getSongUrl(song.id, 'standard')
    console.log('获取歌曲URL响应:', response)
    if (response.body?.data?.[0]?.url) {
      songStore.play({ ...song, url: response.body.data[0].url })
    } else {
      message.warning('该歌曲暂时无法播放')
    }
  } catch (error) {
    console.error('播放歌曲失败:', error)
    message.error('播放失败')
  }
}

const playFmSong = async () => {
  if (!fmSong.value) return
  if (isCurrentFmPlaying.value) {
    songStore.setPlaying(false)
    return
  }
  await playSong(fmSong.value)
}

const nextFmSong = async () => {
  fmSongs.value.shift()
  if (fmSongs.value.length < 2) await loadPersonalFM()
  if (fmSongs.value.length > 0) fmSong.value = fmSongs.value[0]
}

const trashFmSong = async () => {
  if (!fmSong.value) return
  try {
    await window.api.fmTrash(fmSong.value.id)
    message.success('已标记为不喜欢')
    await nextFmSong()
  } catch (error) {
    console.error('FM垃圾桶操作失败:', error)
  }
}

const changeTopSongsType = async (type) => {
  topSongsType.value = type
  await loadTopSongs()
}

const loadRecommendResource = async () => {
  if (!isLoggedIn.value) return
  try {
    const response = await window.api.getRecommendResource()
    if (response.body?.recommend) {
      recommendPlaylists.value = response.body.recommend.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        cover: p.picUrl,
        playCount: p.playcount || 0,
        description: p.copywriter || '',
        createTime: p.createTime,
        isRecommend: true
      }))
    }
  } catch (error) {
    console.error('获取每日推荐歌单失败:', error)
  }
}

const loadRecommendSongs = async () => {
  if (!isLoggedIn.value) return
  try {
    const response = await window.api.getRecommendSongs()
    if (response.body?.data?.dailySongs) {
      recommendSongs.value = response.body.data.dailySongs.slice(0, 20).map((s) => ({
        id: s.id,
        name: s.name,
        artist: s.ar?.map((a) => a.name).join(' / ') || '未知歌手',
        album: s.al?.name || '未知专辑',
        cover: s.al?.picUrl || '',
        duration: s.dt || 0
      }))
    }
  } catch (error) {
    console.error('获取每日推荐歌曲失败:', error)
  }
}

const loadPersonalFM = async () => {
  if (!isLoggedIn.value) return
  try {
    const response = await window.api.getPersonalFM()
    console.log('私人FM数据:', response)
    if (response.body?.data) {
      const newSongs = response.body.data.map((s) => ({
        id: s.id,
        name: s.name,
        artist: s.artists?.map((a) => a.name).join(' / ') || '未知歌手',
        album: s.album?.name || '未知专辑',
        cover: s.album?.picUrl || '',
        duration: s.duration || 0
      }))
      fmSongs.value = [...fmSongs.value, ...newSongs]
      if (!fmSong.value && fmSongs.value.length > 0) fmSong.value = fmSongs.value[0]
    }
  } catch (error) {
    console.error('获取私人FM失败:', error)
  }
}

const loadTopSongs = async () => {
  try {
    const response = await window.api.getTopSongs(topSongsType.value)
    if (response.body?.data) {
      topSongs.value = response.body.data.map((s) => ({
        id: s.id,
        name: s.name,
        artist: s.artists?.map((a) => a.name).join(' / ') || '未知歌手',
        album: s.album?.name || '未知专辑',
        cover: s.album?.picUrl || '',
        duration: s.duration || 0
      }))
    }
  } catch (error) {
    console.error('获取新歌速递失败:', error)
  }
}

const loadPersonalizedPlaylists = async () => {
  try {
    const response = await window.api.getPersonalizedPlaylists(30)
    if (response.body?.result) {
      personalizedPlaylists.value = response.body.result.map((p) => ({
        id: p.id,
        name: p.name,
        cover: p.picUrl,
        playCount: p.playCount || 0,
        description: p.copywriter || '',
        createTime: p.createTime
      }))
    }
  } catch (error) {
    console.error('获取个性化推荐歌单失败:', error)
  }
}

const loadTopPlaylists = async () => {
  try {
    const response = await window.api.getTopPlaylists(undefined, 60)
    if (response.body?.playlists) {
      topPlaylists.value = response.body.playlists.map((p) => ({
        id: p.id,
        name: p.name,
        cover: p.coverImgUrl,
        playCount: p.playCount,
        description: p.description || '暂无描述',
        createTime: p.createTime
      }))
    }
  } catch (error) {
    console.error('获取热门歌单失败:', error)
  }
}

onMounted(async () => {
  try {
    loading.value = true
    await Promise.all([
      loadRecommendResource(),
      loadRecommendSongs(),
      loadPersonalFM(),
      loadTopSongs(),
      loadPersonalizedPlaylists(),
      loadTopPlaylists()
    ])
  } catch (error) {
    console.error('加载首页数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.mainpage {
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;

  // 加载中容器样式
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    gap: 16px;

    .loading-text {
      font-size: 14px;
      margin: 0;
    }
  }

  .mainpage-content {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }

  // Section 通用样式
  .section {
    .section-header {
      margin-bottom: 24px;

      .section-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px 0;
        display: flex;
        align-items: center;
        gap: 8px;

        .ant-icon {
          font-size: 26px;
        }
      }

      .section-subtitle {
        font-size: 14px;
        margin: 0;
        padding-left: 34px;
      }
    }

    // 私人FM样式
    &.fm-section {
      .fm-card {
        display: flex;
        gap: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 24px;
        color: white;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
      }

      .fm-cover {
        position: relative;
        width: 180px;
        height: 180px;
        flex-shrink: 0;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);

        :deep(.ant-image) {
          width: 100%;
          height: 100%;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .fm-playing-indicator {
          position: absolute;
          bottom: 12px;
          left: 12px;
          display: flex;
          gap: 3px;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 12px;
          opacity: 0;
          transition: opacity 0.3s ease;

          &.active {
            opacity: 1;

            span {
              animation: equalizer 1s ease-in-out infinite;

              &:nth-child(1) {
                animation-delay: 0s;
              }
              &:nth-child(2) {
                animation-delay: 0.2s;
              }
              &:nth-child(3) {
                animation-delay: 0.4s;
              }
            }
          }

          span {
            width: 3px;
            height: 14px;
            border-radius: 2px;
          }
        }
      }

      .fm-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;

        .fm-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .fm-artist {
          font-size: 16px;
          opacity: 0.9;
          margin: 0 0 4px 0;
        }

        .fm-album {
          font-size: 14px;
          opacity: 0.7;
          margin: 0 0 4px 0;
        }

        .fm-duration {
          font-size: 13px;
          opacity: 0.75;
          margin: 0 0 20px 0;
        }

        .fm-actions {
          display: flex;
          gap: 12px;

          :deep(.ant-btn) {
            border: none;
            backdrop-filter: blur(10px);

            &:hover {
              transform: scale(1.1);
            }

            &.ant-btn-primary {
              background: var(--n-color);
              color: var(--n-primary-color);

              &:hover {
                background: color-mix(in srgb, var(--n-color) 90%, transparent);
              }
            }
          }
        }
      }
    }

    // 每日推荐歌曲横向滚动
    .songs-scroll-container {
      width: 100%;
      max-width: 100%;
    }

    .songs-scrollbar {
      width: 100%;
      max-width: 100%;
    }

    .songs-scroll {
      display: flex;
      gap: 16px;
      padding-bottom: 12px;
      width: max-content;
      min-width: 100%;
    }

    .song-card {
      flex-shrink: 0;
      width: 140px;
      cursor: pointer;
      transition: transform 0.3s ease;

      &:hover {
        transform: translateY(-4px);

        .play-overlay {
          opacity: 1;
        }
      }

      .song-cover {
        position: relative;
        width: 140px;
        height: 140px;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);

        :deep(.ant-image) {
          width: 100%;
          height: 100%;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;

          .ant-icon {
            color: white;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
          }
        }
      }

      .song-info {
        h4 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: var(--n-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        p {
          font-size: 12px;
          color: var(--n-text-color-3);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    &.new-songs-section {
      .new-songs-tabs {
        display: flex;
        gap: 24px;
        margin-bottom: 20px;

        .tab-item {
          font-size: 14px;
          color: var(--n-text-color-3);
          cursor: pointer;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;

          &:hover {
            color: var(--n-text-color-2);
          }

          &.active {
            color: var(--n-primary-color);
            border-bottom-color: var(--n-primary-color);
            font-weight: 600;
          }
        }
      }

      .new-songs-list {
        background: var(--n-card-color);
        border-radius: 16px;
        padding: 12px;
      }

      .new-song-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: var(--n-hover-color);
        }

        .song-index {
          width: 32px;
          font-size: 16px;
          font-weight: 700;
          color: var(--n-text-color-3);
          text-align: center;

          &.top {
            background: linear-gradient(135deg, #ff6b6b 0%, #ffd93d 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
        }

        .song-cover-small {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          margin-right: 16px;
          flex-shrink: 0;

          :deep(.ant-image) {
            width: 100%;
            height: 100%;

            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
          }

          .image-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--n-pressed-color);
            color: var(--n-text-color-disabled);
          }
        }

        .song-detail {
          flex: 1;
          min-width: 0;

          h4 {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: var(--n-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          p {
            font-size: 12px;
            color: var(--n-text-color-3);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .song-duration {
          font-size: 13px;
          color: var(--n-text-color-disabled);
          font-variant-numeric: tabular-nums;
        }
      }
    }

    .playlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;

      .playlist-card {
        background: var(--n-card-color);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;

        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

          .play-overlay {
            opacity: 1;
          }
        }

        .playlist-cover {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: var(--n-hover-color);

          :deep(.ant-image) {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;

            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              transition: transform 0.3s ease;
            }
          }

          &:hover :deep(.ant-image img) {
            transform: scale(1.05);
          }

          .image-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background: var(--n-pressed-color);
            color: var(--n-text-color-disabled);
            font-size: 48px;
          }

          // 推荐标签
          .recommend-badge {
            position: absolute;
            top: 8px;
            right: 8px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
            z-index: 2;
          }

          .play-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 1;

            :deep(.ant-btn) {
              background: color-mix(in srgb, var(--n-card-color) 92%, transparent);
              border: none;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);

              &:hover {
                background: var(--n-card-color);
                transform: scale(1.1);
              }

              .ant-icon {
                color: var(--n-primary-color);
              }
            }
          }
        }

        .playlist-info {
          padding: 14px;

          h4 {
            font-size: 15px;
            font-weight: 600;
            margin: 0 0 6px 0;
            color: var(--n-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.4;
          }

          .play-count {
            font-size: 12px;
            color: var(--n-text-color-3);
            margin: 0 0 6px 0;
          }

          .description {
            font-size: 12px;
            color: var(--n-text-color-disabled);
            margin: 0;
            line-height: 1.4;
            max-height: calc(1.4em * 2);
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
          }
        }
      }
    }
  }

  // 页面标题样式
  .page-header {
    text-align: center;
    margin-bottom: 50px;

    h2 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--n-text-color);
    }

    .subtitle {
      color: var(--n-text-color-3);
      font-size: 16px;
      margin: 0;
    }
  }

  // 杞挱鍥惧尯鍩?
  .banner-section {
    margin-bottom: 48px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 20px var(--n-pressed-color);

    :deep(.ant-carousel) {
      border-radius: 16px;
    }

    .banner-item {
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
        backdrop-filter: blur(2px);
      }

      .banner-content {
        position: relative;
        z-index: 1;
        text-align: center;
        color: white;

        h2 {
          font-size: 40px;
          margin-bottom: 12px;
          font-weight: 700;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          letter-spacing: 1px;
        }

        p {
          font-size: 18px;
          opacity: 0.95;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }
      }
    }
  }

  // 通用区域样式
  .section {
    margin-bottom: 48px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--n-border-color);

      h3 {
        font-size: 24px;
        font-weight: 700;
        margin: 0;
        color: var(--n-text-color);
        position: relative;
        padding-left: 16px;

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 20px;
          background: linear-gradient(
            180deg,
            var(--n-primary-color) 0%,
            var(--n-primary-color) 100%
          );
          border-radius: 2px;
        }
      }

      :deep(.ant-btn) {
        color: var(--n-text-color-3);
        font-weight: 500;

        &:hover {
          color: var(--n-primary-color);
        }
      }
    }
  }

  // 推荐歌单
  .recommend-playlists {
    .playlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;

      .playlist-card {
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 12px;
        background: var(--n-card-color);
        padding: 16px;
        box-shadow: 0 2px 8px var(--n-hover-color);

        &:hover {
          transform: translateY(-10px);
          box-shadow: 0 8px 24px var(--n-pressed-color);

          .play-overlay {
            opacity: 1;
          }

          :deep(.ant-image) {
            transform: scale(1.05);
          }
        }

        .playlist-cover {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          aspect-ratio: 1;
          margin-bottom: 12px;

          :deep(.ant-image) {
            width: 100%;
            height: 100%;
            transition: transform 0.3s ease;
          }

          .play-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 100%);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;

            :deep(.ant-btn) {
              transform: scale(1.2);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
          }

          .image-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--n-hover-color);
            color: var(--n-text-color-disabled);
          }
        }

        .playlist-info {
          padding: 4px;

          h4 {
            font-size: 14px;
            font-weight: 600;
            color: var(--n-text-color);
            margin: 0 0 6px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          p {
            font-size: 12px;
            color: var(--n-text-color-3);
            margin: 0;
          }
        }
      }
    }
  }

  // 鏂版瓕鎺ㄨ崘
  .new-songs {
    .song-list {
      background: var(--n-card-color);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 8px var(--n-hover-color);

      .song-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-radius: 10px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        margin-bottom: 4px;

        &:hover {
          background: var(--n-hover-color);
          transform: translateX(4px);

          .song-actions {
            opacity: 1;
          }
        }

        .song-index {
          width: 48px;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(
            135deg,
            var(--n-primary-color) 0%,
            var(--n-primary-color) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        :deep(.song-cover) {
          width: 64px;
          height: 64px;
          border-radius: 8px;
          margin-right: 16px;
          box-shadow: 0 2px 8px var(--n-pressed-color);
          flex-shrink: 0;
        }

        .song-info {
          flex: 1;
          min-width: 0;

          .song-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--n-text-color);
            margin-bottom: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .song-artist {
            font-size: 12px;
            color: var(--n-text-color-3);
          }
        }

        .song-album {
          flex: 1;
          font-size: 13px;
          color: var(--n-text-color-2);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0 16px;
        }

        .song-duration {
          width: 70px;
          text-align: center;
          font-size: 13px;
          color: var(--n-text-color-3);
          font-variant-numeric: tabular-nums;
        }

        .song-actions {
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
      }
    }
  }

  // 热门歌手
  .hot-artists {
    .artist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 32px;

      .artist-card {
        text-align: center;
        cursor: pointer;
        padding: 20px;
        border-radius: 12px;
        background: var(--n-card-color);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 8px var(--n-hover-color);

        &:hover {
          transform: translateY(-10px);
          box-shadow: 0 8px 24px var(--n-pressed-color);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--n-primary-color) 16%, transparent) 0%,
            var(--n-card-color) 100%
          );

          :deep(.ant-avatar) {
            box-shadow: 0 8px 24px var(--n-primary-color);
            border-color: var(--color-primary-light-4);
          }
        }

        :deep(.ant-avatar) {
          margin-bottom: 16px;
          border: 3px solid var(--n-hover-color);
          box-shadow: 0 4px 12px var(--n-pressed-color);
          transition: all 0.3s ease;
        }

        h4 {
          font-size: 16px;
          font-weight: 600;
          color: var(--n-text-color);
          margin: 0 0 6px 0;
        }

        p {
          font-size: 13px;
          color: var(--n-text-color-3);
          margin: 0;
        }
      }
    }
  }

  // 鍥剧墖鍗犱綅绗?
  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--n-hover-color);

    svg {
      font-size: 48px;
      color: var(--n-text-color-disabled);
    }
  }
}

// 鏆楅粦妯″紡閫傞厤
:root.dark {
  .mainpage {
    .section-header h3 {
      color: #e5eaf3;
    }

    .new-songs {
      .song-item {
        &:hover {
          background-color: #2c2c2c;
        }

        .song-name {
          color: #e5eaf3;
        }

        .song-album {
          color: #a3a6ad;
        }
      }
    }

    .recommend-playlists {
      .playlist-card {
        .playlist-info {
          h4 {
            color: #e5eaf3;
          }
        }
      }
    }

    .hot-artists {
      .artist-card {
        h4 {
          color: #e5eaf3;
        }
      }
    }

    .image-placeholder {
      background-color: #2c2c2c;
    }
  }
}

// 鍝嶅簲寮忚璁?
@media (max-width: 1200px) {
  .mainpage .section.hot-playlists .playlist-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .mainpage {
    padding: 20px;

    .page-header h2 {
      font-size: 28px;
    }

    .section.hot-playlists .playlist-grid {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
    }

    .section.fm-section .fm-card {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .section.fm-section .fm-info .fm-actions {
      justify-content: center;
    }
  }
}

// 播放音效动画
@keyframes equalizer {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 14px;
  }
}
</style>
