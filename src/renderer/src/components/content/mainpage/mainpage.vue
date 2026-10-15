<template>
  <div class="mainpage">
    <!-- 加载中状态：Spotify 式骨架屏 -->
    <div v-if="loading" class="mainpage-content skeleton-page" aria-busy="true">
      <div v-for="s in 2" :key="'sk-sec-' + s" class="section">
        <div class="section-header">
          <n-skeleton :width="160" :height="24" :sharp="false" />
          <n-skeleton :width="220" :height="14" :sharp="false" style="margin-top: 10px" />
        </div>
        <div class="playlist-grid" :class="playlistLayoutClass">
          <div v-for="n in 10" :key="'sk-card-' + s + '-' + n" class="playlist-card skeleton-card">
            <div class="skeleton-cover">
              <n-skeleton :sharp="false" style="width: 100%; height: 100%; border-radius: 12px" />
            </div>
            <div class="playlist-info">
              <n-skeleton text width="90%" :sharp="false" />
              <n-skeleton text width="55%" :sharp="false" style="margin-top: 6px" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mainpage-content">
      <!-- 每日推荐歌曲（仅登录用户） -->
      <div
        v-if="
          homeSections.dailySongs && isLoggedIn && recommendSongs.length > 0 && showFirstFoldContent
        "
        class="section"
      >
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

      <div ref="secondaryContentSentinel" class="secondary-content-sentinel"></div>

      <!-- 新歌速递（所有用户） -->
      <div
        v-if="homeSections.newSongs && topSongs.length > 0 && showSecondaryContent"
        class="section new-songs-section"
      >
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
      <div
        v-if="
          homeSections.recommendPlaylists &&
          isLoggedIn &&
          recommendPlaylists.length > 0 &&
          showSecondaryContent
        "
        class="section"
      >
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ff6b6b"><FlameOutline /></n-icon>
            每日推荐歌单
          </h2>
          <p class="section-subtitle">根据你的音乐口味为你推荐</p>
        </div>
        <div class="playlist-grid" :class="playlistLayoutClass">
          <div
            v-for="playlist in gridDisplay(recommendPlaylists, 'recommend')"
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
        <div v-if="recommendPlaylists.length > HOME_GRID_CAP" class="show-more">
          <n-button tertiary size="small" @click="toggleGrid('recommend')">
            {{ expandedGrids.recommend ? '收起' : `显示更多 (${recommendPlaylists.length})` }}
          </n-button>
        </div>
      </div>

      <!-- 个性化推荐歌单 -->
      <div
        v-if="homeSections.personalized && personalizedPlaylists.length > 0 && showSecondaryContent"
        class="section"
      >
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ffd93d"><StarOutline /></n-icon>
            {{ isLoggedIn ? '为你推荐' : '精选歌单' }}
          </h2>
          <p class="section-subtitle">发现更多好音乐</p>
        </div>
        <div class="playlist-grid" :class="playlistLayoutClass">
          <div
            v-for="playlist in gridDisplay(personalizedPlaylists, 'personalized')"
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
        <div v-if="personalizedPlaylists.length > HOME_GRID_CAP" class="show-more">
          <n-button tertiary size="small" @click="toggleGrid('personalized')">
            {{ expandedGrids.personalized ? '收起' : `显示更多 (${personalizedPlaylists.length})` }}
          </n-button>
        </div>
      </div>

      <div
        v-if="homeSections.topPlaylists && topPlaylists.length > 0 && showSecondaryContent"
        class="section"
      >
        <div class="section-header">
          <h2 class="section-title">
            <n-icon color="#ff6b6b"><FlameOutline /></n-icon>
            热门歌单
          </h2>
          <p class="section-subtitle">最受欢迎的精选歌单</p>
        </div>
        <div class="playlist-grid" :class="playlistLayoutClass">
          <div
            v-for="playlist in gridDisplay(topPlaylists, 'top')"
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
        <div v-if="topPlaylists.length > HOME_GRID_CAP" class="show-more">
          <n-button tertiary size="small" @click="toggleGrid('top')">
            {{ expandedGrids.top ? '收起' : `显示更多 (${topPlaylists.length})` }}
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  PlayOutline,
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

const recommendPlaylists = ref([])
const personalizedPlaylists = ref([])
const topPlaylists = ref([])
const recommendSongs = ref([])
const topSongs = ref([])
const topSongsType = ref(0)
const loading = ref(true)
const showFirstFoldContent = ref(false)
const showSecondaryContent = ref(false)
const secondaryContentSentinel = ref(null)
let secondaryContentObserver = null
let secondaryContentRequested = false

// 首页歌单显示方式：网格 / 横向货架（在设置中切换，跟随实时生效）
const playlistLayout = ref('grid')

// 首页各区块显示开关（设置中自定义）
const DEFAULT_HOME_SECTIONS = {
  dailySongs: true,
  newSongs: true,
  recommendPlaylists: true,
  personalized: true,
  topPlaylists: true
}
const homeSections = ref({ ...DEFAULT_HOME_SECTIONS })

// 歌单网格默认显示上限 + 展开状态
const HOME_GRID_CAP = 24
const expandedGrids = ref({ recommend: false, personalized: false, top: false })
const gridDisplay = (list, key) => (expandedGrids.value[key] ? list : list.slice(0, HOME_GRID_CAP))
const toggleGrid = (key) => {
  expandedGrids.value = { ...expandedGrids.value, [key]: !expandedGrids.value[key] }
}

const readHomeSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('appSettings') || '{}')
    playlistLayout.value = saved.playlistLayout === 'shelf' ? 'shelf' : 'grid'
    homeSections.value = { ...DEFAULT_HOME_SECTIONS, ...(saved.homeSections || {}) }
  } catch {
    playlistLayout.value = 'grid'
    homeSections.value = { ...DEFAULT_HOME_SECTIONS }
  }
}
const handleSettingsChanged = () => readHomeSettings()
const playlistLayoutClass = computed(() =>
  playlistLayout.value === 'shelf' ? 'is-shelf' : 'is-grid'
)

const topSongsTabs = [
  { label: '全部', value: 0 },
  { label: '华语', value: 7 },
  { label: '欧美', value: 96 },
  { label: '日本', value: 8 },
  { label: '韩国', value: 16 }
]

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

const loadSecondaryContent = async () => {
  if (secondaryContentRequested) return
  secondaryContentRequested = true
  try {
    await Promise.all([
      loadRecommendResource(),
      loadPersonalizedPlaylists(),
      loadTopPlaylists(),
      loadTopSongs()
    ])
    showSecondaryContent.value = true
  } catch (error) {
    console.error('加载首页次屏内容失败:', error)
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
  readHomeSettings()
  window.addEventListener('app-settings-changed', handleSettingsChanged)
  try {
    loading.value = true
    await loadRecommendSongs()
    showFirstFoldContent.value = true
    loading.value = false
    await nextTick()

    const rootEl = document.querySelector('.main-content')
    if (secondaryContentSentinel.value && 'IntersectionObserver' in window) {
      secondaryContentObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          if (entry?.isIntersecting) {
            void loadSecondaryContent()
            secondaryContentObserver?.disconnect()
            secondaryContentObserver = null
          }
        },
        { root: rootEl, rootMargin: '280px 0px' }
      )
      secondaryContentObserver.observe(secondaryContentSentinel.value)
    } else {
      requestAnimationFrame(() => {
        void loadSecondaryContent()
      })
    }
  } catch (error) {
    console.error('加载首页数据失败:', error)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  secondaryContentObserver?.disconnect()
  secondaryContentObserver = null
  window.removeEventListener('app-settings-changed', handleSettingsChanged)
})
</script>

<style scoped lang="scss">
.mainpage {
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;

  // 显示更多/收起按钮
  .show-more {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }

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
            color: var(--primary-color, var(--n-primary-color));
            border-bottom-color: var(--primary-color, var(--n-primary-color));
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
          background: color-mix(
            in srgb,
            var(--primary-color, var(--n-primary-color)) 12%,
            transparent
          );
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
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x proximity;
      gap: 20px;
      padding-bottom: 8px;

      .playlist-card {
        flex: 0 0 190px;
        scroll-snap-align: start;
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
          aspect-ratio: 1;
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
                color: var(--primary-color, var(--n-primary-color));
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
            var(--primary-color, var(--n-primary-color)) 0%,
            var(--primary-color, var(--n-primary-color)) 100%
          );
          border-radius: 2px;
        }
      }

      :deep(.ant-btn) {
        color: var(--n-text-color-3);
        font-weight: 500;

        &:hover {
          color: var(--primary-color, var(--n-primary-color));
        }
      }
    }
  }

  // 推荐歌单
  .recommend-playlists {
    .playlist-grid {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x proximity;
      gap: 24px;
      padding-bottom: 8px;

      .playlist-card {
        flex: 0 0 190px;
        scroll-snap-align: start;
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
          background: color-mix(
            in srgb,
            var(--primary-color, var(--n-primary-color)) 12%,
            transparent
          );
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
            var(--primary-color, var(--n-primary-color)) 0%,
            var(--primary-color, var(--n-primary-color)) 100%
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
            color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 16%, transparent) 0%,
            var(--n-card-color) 100%
          );

          :deep(.ant-avatar) {
            box-shadow: 0 8px 24px var(--primary-color, var(--n-primary-color));
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

  .secondary-content-sentinel {
    width: 100%;
    height: 1px;
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

/* 长列表/网格性能优化：跳过视口外卡片的渲染与布局（保留占位尺寸避免滚动跳动） */
.playlist-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 230px;
}

/* 歌单显示方式：网格（is-grid）覆盖默认的横向货架（is-shelf 即基础样式） */
.playlist-grid.is-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  overflow: visible !important;
}
.playlist-grid.is-grid .playlist-card {
  flex: none !important;
}
.song-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 190px;
}

/* 卡片悬浮主色高光环（跟随圆角），覆盖各区块原有 hover 阴影 */
.playlist-card:hover,
.song-card:hover {
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.14),
    0 0 0 2px color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 45%, transparent) !important;
}

/* 骨架屏 */
.skeleton-page {
  .skeleton-card {
    cursor: default;
  }
  .skeleton-cover {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
  }
  .playlist-info {
    padding: 10px 4px 4px;
  }
}
</style>
