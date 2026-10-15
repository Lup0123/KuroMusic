<template>
  <n-config-provider :theme="currentTheme" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <AIPlaylistModal v-if="windowRole === 'ai'" />
          <router-view v-else-if="windowRole === 'main'" />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, ref, provide, onMounted, onBeforeUnmount, watchEffect } from 'vue'
import { darkTheme, NConfigProvider } from 'naive-ui'
import AIPlaylistModal from '@/components/ai/AIPlaylistModal.vue'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useUserStore } from '@/stores/userStore'

const isDarkMode = ref(false)
const windowRole = ref('unknown')
const primaryColor = ref('#165DFF')
const primaryHoverColor = ref('#4080FF')
const aiPlaylistStore = useAiPlaylistStore()

const PRIMARY_HOVER_COLOR_MAP = {
  '#165DFF': '#4080FF',
  '#3491FA': '#5AA9FA',
  '#722ED1': '#9254DE',
  '#D91AD9': '#EA3FEA',
  '#F53F3F': '#F76560',
  '#F77234': '#FF9A2E',
  '#F7BA1E': '#F9CC45',
  '#00B42A': '#23C343',
  '#14C9C9': '#33D4CF',
  '#86909C': '#A4ACB5'
}

const normalizeColor = (color = '') => color.trim().toUpperCase()
const resolvePrimaryHoverColor = (color, hoverColor) => {
  const normalizedHoverColor = normalizeColor(hoverColor)
  if (normalizedHoverColor) {
    return normalizedHoverColor
  }
  const normalizedColor = normalizeColor(color)
  return PRIMARY_HOVER_COLOR_MAP[normalizedColor] || '#4080FF'
}

const applyPrimaryTheme = (color, hoverColor) => {
  const normalizedColor = normalizeColor(color)
  if (!normalizedColor) {
    return
  }
  primaryColor.value = normalizedColor
  primaryHoverColor.value = resolvePrimaryHoverColor(normalizedColor, hoverColor)
  localStorage.setItem('primary-color', normalizedColor)
  localStorage.setItem('primary-hover-color', primaryHoverColor.value)
}

// 云端状态同步：在手机等其他设备上的喜欢 / 歌单 / 资料变更，
// 在主窗口重新获得焦点时后台拉取（30 秒内最多一次）
const CLOUD_SYNC_MIN_INTERVAL = 30 * 1000
let lastCloudSyncAt = 0
let unsubscribeLikedChanged = null

const syncCloudState = async () => {
  const userStore = useUserStore()
  const uid = userStore.userInfo?.userId || userStore.userInfo?.id
  if (!uid) return
  if (Date.now() - lastCloudSyncAt < CLOUD_SYNC_MIN_INTERVAL) return
  lastCloudSyncAt = Date.now()
  const playlistStore = usePlaylistStore()
  await Promise.allSettled([playlistStore.loadUserPlaylists(uid), userStore.refreshUserInfo()])
}

const handleWindowFocus = () => {
  void syncCloudState()
}
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') void syncCloudState()
}

const currentTheme = computed(() => (isDarkMode.value ? darkTheme : null))

const APP_FONT_FAMILY =
  "'Tektur', 'YouAiHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif"

const themeOverrides = computed(() => ({
  common: {
    primaryColor: primaryColor.value,
    primaryColorHover: primaryHoverColor.value,
    fontFamily: APP_FONT_FAMILY
  },
  Slider: {
    fillColor: primaryColor.value,
    fillColorHover: primaryHoverColor.value
  }
}))

// 提供主题切换方法给子组件
provide('isDarkMode', isDarkMode)
provide('primaryColor', primaryColor)
provide('primaryHoverColor', primaryHoverColor)
provide('toggleDarkMode', () => {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme-mode', isDarkMode.value ? 'dark' : 'light')
})
provide('setPrimaryColor', (color, hoverColor) => applyPrimaryTheme(color, hoverColor))
provide('setThemePalette', (palette) => applyPrimaryTheme(palette?.primary, palette?.hover))

watchEffect(() => {
  document.documentElement.style.setProperty('--primary-color', primaryColor.value)
  document.documentElement.style.setProperty('--primary-hover-color', primaryHoverColor.value)
})

// 让原生控件（滚动条、输入框等）跟随明暗主题
watchEffect(() => {
  document.documentElement.style.colorScheme = isDarkMode.value ? 'dark' : 'light'
})

// 深色玻璃外壳：浅色主题下调低透明度更通透，深色主题下更实，二者都像玻璃
watchEffect(() => {
  const root = document.documentElement.style
  if (isDarkMode.value) {
    root.setProperty('--glass-shell-bg', 'rgba(20, 22, 28, 0.62)')
    root.setProperty('--glass-shell-border', 'rgba(255, 255, 255, 0.08)')
    // 弹窗/抽屉：深色玻璃
    root.setProperty('--glass-panel-bg', 'rgba(24, 26, 32, 0.86)')
    root.setProperty('--glass-panel-border', 'rgba(255, 255, 255, 0.1)')
  } else {
    root.setProperty('--glass-shell-bg', 'rgba(24, 26, 32, 0.4)')
    root.setProperty('--glass-shell-border', 'rgba(255, 255, 255, 0.14)')
    // 弹窗/抽屉：浅色玻璃（跟随明暗主题）
    root.setProperty('--glass-panel-bg', 'rgba(255, 255, 255, 0.72)')
    root.setProperty('--glass-panel-border', 'rgba(0, 0, 0, 0.08)')
  }
})

onMounted(() => {
  // 恢复主题设置
  const savedMode = localStorage.getItem('theme-mode')
  if (savedMode) {
    isDarkMode.value = savedMode === 'dark'
  }
  const savedColor = localStorage.getItem('primary-color')
  if (savedColor) {
    const savedHoverColor = localStorage.getItem('primary-hover-color')
    applyPrimaryTheme(savedColor, savedHoverColor)
  }

  // 任一窗口喜欢 / 取消喜欢后，主进程广播，各窗口的 store 同步更新
  unsubscribeLikedChanged =
    window.api?.onLikedSongChanged?.(({ songId, liked } = {}) => {
      if (songId) usePlaylistStore().applyLikedChange(songId, liked)
    }) || null

  globalThis?.window?.api
    ?.getWindowRole?.()
    .then((role) => {
      windowRole.value = role === 'ai' ? 'ai' : 'main'
      if (windowRole.value === 'ai') {
        aiPlaylistStore.openModal()
      } else {
        // AI 窗口等其它窗口创建/修改本地歌单后，主窗口自动刷新列表
        window.api?.onPlaylistsChanged?.(() => {
          usePlaylistStore().loadLocalPlaylists()
        })
        window.addEventListener('focus', handleWindowFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    })
    .catch(() => {
      windowRole.value = 'main'
    })
})

onBeforeUnmount(() => {
  unsubscribeLikedChanged?.()
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style lang="scss" scoped></style>
