<template>
  <div class="mainpage">
    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-container">
      <a-spin :size="40" />
      <p class="loading-text">正在加载歌单...</p>
    </div>

    <!-- 热门歌单网格 -->
    <div v-else class="section hot-playlists">
      <div class="playlist-grid">
        <div
          class="playlist-card"
          v-for="playlist in topPlaylists"
          :key="playlist.id"
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
            <p class="play-count">{{ playlist.playCount }} 次播放</p>
            <p class="description">{{ playlist.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { IconPlayArrow, IconImage } from '@arco-design/web-vue/es/icon'

import { storeToRefs } from 'pinia'
import { useIndexStore } from '@/stores/indexStore'
import { usePlaylistStore } from '@/stores/playlistStore'

const indexStore = useIndexStore()
const { setCurIndex } = indexStore
const playlistStore = usePlaylistStore()
const { setCurrentPlaylist } = playlistStore
// 热门歌单数据
const topPlaylists = ref([])
const loading = ref(true)

const gotodetail = async (playlist) => {
  setCurIndex('PlaylistDetail')
  setCurrentPlaylist(playlist)
}

onMounted(async () => {
  try {
    loading.value = true
    const response = await window.api.getTopPlaylists()
    console.log('Hot Playlists Response:', response)
    // 假设 response.data 是歌单数组
    topPlaylists.value = response.body.playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      cover: playlist.coverImgUrl,
      playCount: playlist.playCount,
      description: playlist.description || '暂无描述',
      createTime: playlist.createTime
    }))
  } catch (error) {
    console.error('Error fetching hot playlists:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
@import './mainpage.scss';
</style>
