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

    <!-- 歌词页面抽屉 - 从底部上拉 -->
    <transition name="slide-up">
      <div v-if="showLyric" class="lyric-drawer-container">
        <div class="lyric-drawer-header">
          <el-button type="primary" :icon="ArrowDown" @click="closeLyric"> 返回 </el-button>
        </div>
        <LyricPlayer />
      </div>
    </transition>
  </el-container>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { ArrowDown } from '@element-plus/icons-vue'
import SongList from '@/components/content/playlist/songlist.vue'
import myMusic from '@/components/content/my-music/my-music.vue'
import PlayerFooter from '@/components/content/player-footer/player-footer.vue'
import mainpage from '@/components/content/mainpage/mainpage.vue'
import Navbar from '@/components/layout/navbar/navbar.vue'
import Sidebar from '@/components/layout/sidebar/sidebar.vue'
import Search from '@/components/content/songsearch/songsearch.vue'
import LyricPlayer from '@/views/PlayerView.vue'

const route = useRoute()
const router = useRouter()

// 全局变量
const indexStore = useIndexStore()
const { cur_index } = storeToRefs(indexStore)

const songStore = useSongStore()
const { showPlaylist, showLyric } = storeToRefs(songStore)

// 创建组件映射对象
const componentMap = {
  mainpage: mainpage,
  'my-music': myMusic,
  favorites: null,
  'recently-played': null,
  songsearch: Search
}

// 计算当前应该显示的组件
const currentComponent = computed(() => {
  return componentMap[cur_index.value] || mainpage
})

// 监听路由变化，控制歌词抽屉显示
watch(
  () => route.name,
  (newName) => {
    showLyric.value = newName === 'Lyric'
  },
  { immediate: true }
)

// 关闭歌词页面
const closeLyric = () => {
  router.push('/')
}
</script>

<style scoped>
@import './layout.css';

/* 歌词抽屉容器 - 从底部上拉 */

</style>
