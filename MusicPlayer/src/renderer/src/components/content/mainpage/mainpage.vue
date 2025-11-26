<template>
  <div class="mainpage">
    <!-- 热门歌单网格 -->
    <div class="section hot-playlists">
      <div class="playlist-grid">
        <div class="playlist-card" v-for="playlist in topPlaylists" :key="playlist.id" @click="gotodetail(playlist)">
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

const gotodetail = async (playlist) => {
  setCurIndex('PlaylistDetail')
  setCurrentPlaylist(playlist)
}


onMounted(async () => {
  try {
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
  }
})
</script>

<style scoped lang="scss">
@import './mainpage.scss';
</style>
