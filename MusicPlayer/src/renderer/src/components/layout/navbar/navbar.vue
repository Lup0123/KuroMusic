<template>
  <el-header class="header draggable-area">
    <div class="header-left">
      <el-button type="text" size="large" class="no-drag">
        <el-icon><Menu /></el-icon>
      </el-button>
      <span class="app-title">Music Player</span>
    </div>

    <div class="header-center draggable-area">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索音乐、歌手、专辑..."
        prefix-icon="Search"
        size="large"
        class="no-drag"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleClearSearch"
        style="width: 400px">
        <template #append>
          <el-button :icon="Search" @click="handleSearch" />
        </template>
      </el-input>
    </div>

    <div class="header-right">
      <!-- 暗黑模式切换按钮 -->
      <el-button
        type="text"
        size="large"
        @click="toggleDarkMode"
        class="no-drag">
        <el-icon v-if="isDarkMode"><Sunny /></el-icon>
        <el-icon v-else><Moon /></el-icon>
      </el-button>
      <el-button type="text" size="large" class="no-drag">
        <el-icon><Setting /></el-icon>
      </el-button>
      <el-button type="text" size="large" class="no-drag">
        <el-icon><User /></el-icon>
      </el-button>
      <!-- 播放列表按钮 -->
      <el-button
        type="text"
        size="large"
        class="no-drag"
        @click="togglePlaylist"
        :class="{ active: showPlaylist }">
        <el-icon><List /></el-icon>
      </el-button>
      <!-- 添加自定义窗口控制按钮 -->
      <div class="window-controls">
        <el-button
          class="window-btn minimize no-drag"
          type="text"
          @click="minimizeWindow">
          <span class="btn-icon">—</span>
        </el-button>
        <el-button
          class="window-btn maximize no-drag"
          type="text"
          @click="maximizeWindow">
          <span class="btn-icon">□</span>
        </el-button>
        <el-button
          class="window-btn close no-drag"
          type="text"
          @click="closeWindow">
          <span class="btn-icon">✕</span>
        </el-button>
        <el-button type="text" size="large" class="no-drag" @click="testapiFUC">
          Testapi
        </el-button>
      </div>
    </div>
  </el-header>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSearchStore } from '@/stores/searchStore'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const songStore = useSongStore()
const { showPlaylist } = storeToRefs(songStore)

const indexStore = useIndexStore()
const { setCurIndex } = indexStore

const searchStore = useSearchStore()
const { setSearchKeyword } = searchStore

// 响应式数据
const searchKeyword = ref('')
const isDarkMode = ref(document.documentElement.classList.contains('dark'))

// 处理搜索
const handleSearch = () => {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  console.log('Searching for:', searchKeyword.value)

  // 保存搜索关键词到 store
  setSearchKeyword(searchKeyword.value.trim())

  // 跳转到搜索页
  setCurIndex('songsearch')
}

// 清空搜索
const handleClearSearch = () => {
  searchKeyword.value = ''
  setSearchKeyword('')
}

// 切换播放列表
const togglePlaylist = () => {
  showPlaylist.value = !showPlaylist.value
}

// 窗口控制方法
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

// 切换暗黑模式
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('darkMode', isDarkMode.value ? 'dark' : 'light')
}

// 测试api
const testapiFUC = async () => {
  console.log('Testing api?...')
}

// 初始化暗黑模式
onMounted(() => {
  const savedMode = localStorage.getItem('darkMode')
  if (savedMode) {
    const shouldBeDark = savedMode === 'dark'
    if (shouldBeDark !== isDarkMode.value) {
      toggleDarkMode()
    }
  }
})
</script>

<style scoped>
/* 导入相关样式 */
@import './navbar.css';

.header-right .el-button.active {
  color: #409eff;
}
</style>
