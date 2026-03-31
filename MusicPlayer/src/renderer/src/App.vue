<template>
  <n-config-provider
    :theme="currentTheme"
    :theme-overrides="{ common: { primaryColor: primaryColor } }"
  >
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, ref, provide, onMounted } from 'vue'
import { darkTheme } from 'naive-ui'

const isDarkMode = ref(false)
const primaryColor = ref('#165DFF')

const currentTheme = computed(() => (isDarkMode.value ? darkTheme : null))

// 提供主题切换方法给子组件
provide('isDarkMode', isDarkMode)
provide('primaryColor', primaryColor)
provide('toggleDarkMode', () => {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme-mode', isDarkMode.value ? 'dark' : 'light')
})
provide('setPrimaryColor', (color) => {
  primaryColor.value = color
  localStorage.setItem('primary-color', color)
})

onMounted(() => {
  // 恢复主题设置
  const savedMode = localStorage.getItem('theme-mode')
  if (savedMode) {
    isDarkMode.value = savedMode === 'dark'
  }
  const savedColor = localStorage.getItem('primary-color')
  if (savedColor) {
    primaryColor.value = savedColor
  }
})
</script>

<style lang="scss" scoped></style>
