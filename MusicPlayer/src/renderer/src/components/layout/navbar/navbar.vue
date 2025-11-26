<template>
  <a-layout-header class="header draggable-area">
    <div class="header-left">
      <a-button type="text" size="large" class="no-drag">
        <template #icon>
          <icon-menu />
        </template>
      </a-button>
      <span class="app-title">Music Player</span>
    </div>

    <div class="header-center draggable-area">
      <a-input-search
        v-model="searchKeyword"
        placeholder="搜索音乐、歌手、专辑..."
        size="large"
        class="no-drag"
        allow-clear
        @press-enter="handleSearch"
        @clear="handleClearSearch"
        @search="handleSearch"
        style="width: 400px"
      >
        <template #prefix>
          <icon-search />
        </template>
      </a-input-search>
    </div>

    <div class="header-right">
      <!-- 暗黑模式切换按钮 -->
      <a-button type="text" size="large" @click="toggleDarkMode" class="no-drag">
        <template #icon>
          <icon-sun v-if="isDarkMode" />
          <icon-moon v-else />
        </template>
      </a-button>
      <a-button type="text" size="large" class="no-drag">
        <template #icon>
          <icon-settings />
        </template>
      </a-button>
      <a-button type="text" size="large" class="no-drag">
        <template #icon>
          <icon-user />
        </template>
      </a-button>
      <!-- 播放列表按钮 -->
      <a-button
        type="text"
        size="large"
        class="no-drag"
        @click="togglePlaylist"
        :class="{ active: showPlaylist }"
      >
        <template #icon>
          <icon-list />
        </template>
      </a-button>

      <!-- 自定义窗口控制按钮 -->
      <div class="window-controls">
        <a-button class="no-drag" type="text" @click="minimizeWindow" size="large">
          <template #icon>
            <icon-minus size="30" />
          </template>
        </a-button>
        <a-button class="no-drag" type="text" @click="maximizeWindow" size="large ">
          <template #icon>
            <icon-fullscreen />
          </template>
        </a-button>
        <a-button class="no-drag" type="text" @click="closeWindow" size="large">
          <template #icon>
            <icon-close size="30" />
          </template>
        </a-button>
        <a-button type="text" size="large" class="no-drag" @click="testapiFUC"> Testapi </a-button>
      </div>
    </div>
  </a-layout-header>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSearchStore } from '@/stores/searchStore'
import { storeToRefs } from 'pinia'
import { Message } from '@arco-design/web-vue'
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconSettings,
  IconUser,
  IconList,
  IconMenu,
  IconMinus,
  IconFullscreen,
  IconClose
} from '@arco-design/web-vue/es/icon'

const songStore = useSongStore()
const { showPlaylist, currentSong } = storeToRefs(songStore)

const indexStore = useIndexStore()
const { setCurIndex } = indexStore

const searchStore = useSearchStore()
const { setSearchKeyword, setHasSearched, setLoading } = searchStore

const searchKeyword = ref('')
const isDarkMode = ref(document.body.getAttribute('arco-theme') === 'dark')

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    Message.warning('请输入搜索关键词')
    return
  }

  console.log('Searching for:', searchKeyword.value)

  // 设置搜索关键词到 store，触发搜索页面的监听
  setSearchKeyword(searchKeyword.value.trim())

  // 切换到搜索页面
  setCurIndex('songsearch')
}

const handleClearSearch = () => {
  searchKeyword.value = ''
  setSearchKeyword('')
  setHasSearched(false)
}

const togglePlaylist = () => {
  showPlaylist.value = !showPlaylist.value
}

const minimizeWindow = () => {
  if (window.api) {
    window.api.minimize()
  }
}

const maximizeWindow = () => {
  if (window.api) {
    window.api.maximize()
  }
}

const closeWindow = () => {
  if (window.api) {
    window.api.close()
  }
}

const toggleDarkMode = () => {
  const newTheme = isDarkMode.value ? 'light' : 'dark'
  document.body.setAttribute('arco-theme', newTheme)
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('arco-theme', newTheme)
}

const testapiFUC = async () => {
  try {
    const response = await window.api.getTopPlaylists()
    console.log('Hot Playlists Response:', response)
  } catch (error) {
    console.error('Error calling API:', error)
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('arco-theme')
  if (savedTheme) {
    document.body.setAttribute('arco-theme', savedTheme)
    isDarkMode.value = savedTheme === 'dark'
  }
})
</script>

<style scoped>
@import './navbar.css';

.header-right .a-button.active {
  color: rgb(var(--primary-6));
}
</style>
