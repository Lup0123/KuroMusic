<template>
  <a-layout class="music-player-layout">
    <!-- 顶部导航栏 -->
    <Navbar />

    <a-layout class="content-container">
      <!-- 左侧边栏 -->
      <Sidebar />

      <!-- 主内容区域 -->
      <a-layout-content class="main-content">
        <component :is="currentComponent" />
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
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { IconArrowDown } from '@arco-design/web-vue/es/icon'
import SongList from '@/components/content/playlist/songlist.vue'
import myMusic from '@/components/content/my-music/my-music.vue'
import PlayerFooter from '@/components/content/player-footer/player-footer.vue'
import mainpage from '@/components/content/mainpage/mainpage.vue'
import Navbar from '@/components/layout/navbar/navbar.vue'
import Sidebar from '@/components/layout/sidebar/sidebar.vue'
import Search from '@/components/content/songsearch/songsearch.vue'
import LyricPlayer from '@/views/PlayerView.vue'
import PlaylistDetail from '@/components/content/Myplaylist/PlaylistDetail.vue'

const route = useRoute()
const router = useRouter()

const indexStore = useIndexStore()
const { cur_index } = storeToRefs(indexStore)

const songStore = useSongStore()
const { showPlaylist, showLyric } = storeToRefs(songStore)

const componentMap = {
  mainpage: mainpage,
  'my-music': myMusic,
  favorites: null,
  'recently-played': null,
  songsearch: Search,
  PlaylistDetail: PlaylistDetail
}

const currentComponent = computed(() => {
  return componentMap[cur_index.value] || mainpage
})

watch(
  () => route.name,
  (newName) => {
    showLyric.value = newName === 'Lyric'
  },
  { immediate: true }
)

const closeLyric = () => {
  router.push('/')
}
</script>

<style scoped lang="scss">
@import './layout.scss';
</style>
