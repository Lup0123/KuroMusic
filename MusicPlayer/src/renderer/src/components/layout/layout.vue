<template>
  <div class="music-player-layout">
    <!-- 顶部导航栏 -->
    <Navbar />
    <div class="content-container">
      <!-- 左侧边栏 -->
      <Sidebar />
      <!-- 主内容区域 -->
      <main class="main-content">
        <router-view />
      </main>
    </div>
    <!-- 底部播放控制栏 -->
    <PlayerFooter />

    <!-- 播放列表弹窗 -->
    <SongList v-model:visible="showPlaylist" />

    <!-- 歌词页面抽屉 - 从底部上拉 -->
    <transition name="slide-up">
      <div v-if="showLyric" class="lyric-drawer-container" :style="lyricDrawerStyle">
        <LyricPlayer />
      </div>
    </transition>

    <AIFloatBall />
    <AIPlaylistModal />
  </div>
</template>

<script setup>
import { watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { useThemeVars } from 'naive-ui'
import SongList from '@/components/content/playlist/songlist.vue'
import PlayerFooter from '@/components/content/player-footer/player-footer.vue'
import Navbar from '@/components/layout/navbar/navbar.vue'
import Sidebar from '@/components/layout/sidebar/sidebar.vue'
import LyricPlayer from '@/views/PlayerView.vue'
import AIFloatBall from '@/components/ai/AIFloatBall.vue'
import AIPlaylistModal from '@/components/ai/AIPlaylistModal.vue'

const route = useRoute()
const themeVars = useThemeVars()

const songStore = useSongStore()
const { showPlaylist, showLyric } = storeToRefs(songStore)

const lyricDrawerStyle = computed(() => ({
  background: themeVars.value.bodyColor
}))

// 字号控制

watch(
  () => route.query.lyric,
  (lyricFlag) => {
    showLyric.value = lyricFlag === '1'
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
// 布局整体样式
.content-container {
  height: calc(100vh - 60px - 80px);
  overflow: hidden;
  background: var(--n-color);
  display: flex;
}

.music-player-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--n-color);
}

// 主内容区域
.main-content {
  background: var(--n-color);
  padding: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  width: 100%;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.3);
    border-radius: 4px;
    transition: background 0.3s ease;

    &:hover {
      background: rgba(128, 128, 128, 0.5);
    }
  }
}

// 歌词抽屉容器
.lyric-drawer-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 80px;
  z-index: 2000;
  overflow: hidden;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
}

// 返回按钮
.lyric-drawer-header {
  position: absolute;
  top: 24px;
  left: 32px;
  z-index: 1000;
}

// 上拉动画
.slide-up-enter-active {
  animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-leave-active {
  animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}

// 确保底部播放栏始终可见
.player-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2001 !important;
}
</style>
