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
import { computed, ref, provide, onMounted, watchEffect } from 'vue'
import { darkTheme, NConfigProvider } from 'naive-ui'
  import AIPlaylistModal from '@/components/ai/AIPlaylistModal.vue'
  import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'
  import { usePlaylistStore } from '@/stores/playlistStore'

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

const currentTheme = computed(() => (isDarkMode.value ? darkTheme : null))

const themeOverrides = computed(() => ({
  common: {
    primaryColor: primaryColor.value,
    primaryColorHover: primaryHoverColor.value
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
        }
      })
    .catch(() => {
      windowRole.value = 'main'
    })
})
</script>

<style lang="scss" scoped></style>
