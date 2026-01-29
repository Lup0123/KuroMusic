<template>
  <div class="mainpage">
    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-container">
      <a-spin :size="40" />
      <p class="loading-text">正在加载内容...</p>
    </div>

    <div v-else class="mainpage-content">
      <!-- 每日推荐歌单 (仅登录用户) -->
      <div v-if="isLoggedIn && recommendPlaylists.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <icon-fire style="color: #ff6b6b" />
            每日推荐歌单
          </h2>
          <p class="section-subtitle">根据你的音乐口味为你推荐</p>
        </div>
        <div class="playlist-grid">
          <div
            class="playlist-card"
            v-for="playlist in recommendPlaylists"
            :key="'rec-' + playlist.id"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <a-image :src="playlist.cover" fit="cover">
                <template #error>
                  <div class="image-placeholder">
                    <icon-image />
                  </div>
                </template>
              </a-image>
              <div class="play-overlay">
                <a-button shape="circle" size="large" type="primary">
                  <template #icon>
                    <icon-play-arrow :size="24" />
                  </template>
                </a-button>
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
            <icon-star-fill style="color: #ffd93d" />
            {{ isLoggedIn ? '为你推荐' : '精选歌单' }}
          </h2>
          <p class="section-subtitle">发现更多好音乐</p>
        </div>
        <div class="playlist-grid">
          <div
            class="playlist-card"
            v-for="playlist in personalizedPlaylists"
            :key="'per-' + playlist.id"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <a-image :src="playlist.cover" fit="cover">
                <template #error>
                  <div class="image-placeholder">
                    <icon-image />
                  </div>
                </template>
              </a-image>
              <div class="play-overlay">
                <a-button shape="circle" size="large" type="primary">
                  <template #icon>
                    <icon-play-arrow :size="24" />
                  </template>
                </a-button>
              </div>
            </div>
            <div class="playlist-info">
              <h4>{{ playlist.name }}</h4>
              <p class="play-count">{{ formatPlayCount(playlist.playCount) }} 次播放</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 热门歌单 -->
      <div v-if="topPlaylists.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <icon-fire style="color: #ff6b6b" />
            热门歌单
          </h2>
          <p class="section-subtitle">最受欢迎的精选歌单</p>
        </div>
        <div class="playlist-grid">
          <div
            class="playlist-card"
            v-for="playlist in topPlaylists"
            :key="'top-' + playlist.id"
            @click="gotodetail(playlist)"
          >
            <div class="playlist-cover">
              <a-image :src="playlist.cover" fit="cover">
                <template #error>
                  <div class="image-placeholder">
                    <icon-image />
                  </div>
                </template>
              </a-image>
              <div class="play-overlay">
                <a-button shape="circle" size="large" type="primary">
                  <template #icon>
                    <icon-play-arrow :size="24" />
                  </template>
                </a-button>
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
import { IconPlayArrow, IconImage, IconFire, IconStarFill } from '@arco-design/web-vue/es/icon'
import { storeToRefs } from 'pinia'
import { useIndexStore } from '@/stores/indexStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useUserStore } from '@/stores/userStore'

const indexStore = useIndexStore()
const { setCurIndex } = indexStore
const playlistStore = usePlaylistStore()
const { setCurrentPlaylist } = playlistStore
const userStore = useUserStore()
const { isLoggedIn } = storeToRefs(userStore)

// 数据
const recommendPlaylists = ref([]) // 每日推荐歌单
const personalizedPlaylists = ref([]) // 个性化推荐歌单
const topPlaylists = ref([]) // 热门歌单
const loading = ref(true)

// 格式化播放次数
const formatPlayCount = (count) => {
  if (!count) return '0'
  if (count >= 100000000) {
    return (count / 100000000).toFixed(1) + '亿'
  }
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return count.toString()
}

const gotodetail = async (playlist) => {
  setCurIndex('PlaylistDetail')
  setCurrentPlaylist(playlist)
}

// 加载每日推荐歌单（仅登录用户）
const loadRecommendResource = async () => {
  if (!isLoggedIn.value) return

  try {
    const response = await window.api.getRecommendResource()
    console.log('每日推荐歌单响应:', response)

    if (response.body && response.body.recommend) {
      recommendPlaylists.value = response.body.recommend.slice(0, 10).map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        cover: playlist.picUrl,
        playCount: playlist.playcount || 0,
        description: playlist.copywriter || '',
        isRecommend: true
      }))
    }
  } catch (error) {
    console.error('获取每日推荐歌单失败:', error)
  }
}

// 加载个性化推荐歌单
const loadPersonalizedPlaylists = async () => {
  try {
    const response = await window.api.getPersonalizedPlaylists(30)
    console.log('个性化推荐歌单响应:', response)

    if (response.body && response.body.result) {
      personalizedPlaylists.value = response.body.result.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        cover: playlist.picUrl,
        playCount: playlist.playCount || 0,
        description: playlist.copywriter || ''
      }))
    }
  } catch (error) {
    console.error('获取个性化推荐歌单失败:', error)
  }
}

// 加载热门歌单
const loadTopPlaylists = async () => {
  try {
    const response = await window.api.getTopPlaylists()
    console.log('热门歌单响应:', response)

    if (response.body && response.body.playlists) {
      topPlaylists.value = response.body.playlists.slice(0, 20).map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        cover: playlist.coverImgUrl,
        playCount: playlist.playCount,
        description: playlist.description || '暂无描述',
        createTime: playlist.createTime
      }))
    }
  } catch (error) {
    console.error('获取热门歌单失败:', error)
  }
}

onMounted(async () => {
  try {
    loading.value = true

    // 并行加载所有数据
    await Promise.all([
      loadRecommendResource(), // 每日推荐（登录用户）
      loadPersonalizedPlaylists(), // 个性化推荐
      loadTopPlaylists() // 热门歌单
    ])
  } catch (error) {
    console.error('加载主页数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
@import './mainpage.scss';
</style>
