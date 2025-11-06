<template>
  <el-container class="music-player-layout">
    <!-- 顶部导航栏 -->
    <Navbar />

    <el-container class="content-container">
      <!-- 左侧边栏 -->
      <Sidebar />

      <!-- 主内容区域 -->
      <el-main class="main-content">
        <component :is="currentComponent" />
      </el-main>
    </el-container>

    <!-- 底部播放控制栏 -->
    <PlayerFooter />

    <!-- 播放列表弹窗 -->
    <SongList v-model:visible="showPlaylist" />
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import SongList from '@/components/content/playlist/songlist.vue'
import myMusic from '@/components/content/my-music/my-music.vue'
import PlayerFooter from '@/components/content/player-footer/player-footer.vue'
import mainpage from '@/components/content/mainpage/mainpage.vue'
import Navbar from '@/components/layout/navbar/navbar.vue'
import Sidebar from '@/components/layout/sidebar/sidebar.vue'
import Search from '@/components/content/songsearch/songsearch.vue'


// 全局变量
const indexStore = useIndexStore()
const { cur_index } = storeToRefs(indexStore)

const songStore = useSongStore()
const { showPlaylist } = storeToRefs(songStore)

// 创建组件映射对象
const componentMap = {
  mainpage: mainpage,
  'my-music': myMusic,
  favorites: null,
  'recently-played': null,
  songsearch: Search,
}

// 计算当前应该显示的组件
const currentComponent = computed(() => {
  return componentMap[cur_index.value] || mainpage
})
</script>

<style scoped>
@import './layout.css';


</style>
