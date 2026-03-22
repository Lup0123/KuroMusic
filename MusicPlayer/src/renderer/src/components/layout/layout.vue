<template>
  <a-layout class="music-player-layout">
    <!-- 顶部导航栏 -->
    <Navbar />

    <a-layout class="content-container">
      <!-- 左侧边栏 -->
      <Sidebar />

      <!-- 主内容区域 -->
      <a-layout-content class="main-content">
        <router-view />
      </a-layout-content>
    </a-layout>

    <!-- 底部播放控制栏 -->
    <PlayerFooter />

    <!-- 播放列表弹窗 -->
    <SongList v-model:visible="showPlaylist" />

    <!-- 歌词页面抽屉 - 从底部上拉 -->
    <transition name="slide-up">
      <div v-if="showLyric" class="lyric-drawer-container">
        <LyricPlayer />
      </div>
    </transition>
  </a-layout>
</template>

<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import SongList from '@/components/content/playlist/songlist.vue'
import PlayerFooter from '@/components/content/player-footer/player-footer.vue'
import Navbar from '@/components/layout/navbar/navbar.vue'
import Sidebar from '@/components/layout/sidebar/sidebar.vue'
import LyricPlayer from '@/views/PlayerView.vue'

const route = useRoute()

const songStore = useSongStore()
const { showPlaylist, showLyric } = storeToRefs(songStore)

watch(
  () => route.query.lyric,
  (lyricFlag) => {
    showLyric.value = lyricFlag === '1'
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
@import './layout.scss';
</style>
