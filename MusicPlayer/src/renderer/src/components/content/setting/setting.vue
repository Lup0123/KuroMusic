<template>
  <a-drawer
    v-model:visible="visible"
    title="设置"
    placement="right"
    :width="450"
    :footer="false"
    unmount-on-close
  >
    <div class="settings-content">
      <!-- 主题颜色设置 -->
      <div class="setting-section">
        <h3 class="setting-title">
          <icon-palette />
          主题颜色
        </h3>
        <div class="theme-colors">
          <div
            v-for="color in themeColors"
            :key="color.value"
            class="color-option"
            :class="{ active: settings.themeColor === color.value }"
            :style="{ backgroundColor: color.color }"
            :title="color.name"
            @click="changeThemeColor(color.value)"
          >
            <icon-check v-if="settings.themeColor === color.value" class="check-icon" />
          </div>
        </div>
      </div>

      <a-divider />

      <!-- 字体大小设置 -->
      <div class="setting-section">
        <h3 class="setting-title">
          <icon-font-colors />
          字体大小
        </h3>
        <div class="font-size-control">
          <a-space direction="vertical" :size="16" style="width: 100%">
            <div class="slider-wrapper">
              <a-slider
                v-model="settings.fontSize"
                :min="12"
                :max="20"
                :step="1"
                :marks="{
                  12: '小',
                  16: '中',
                  20: '大'
                }"
                @change="changeFontSize"
              />
            </div>
            <div class="preview-text" :style="{ fontSize: settings.fontSize + 'px' }">
              预览文本效果 - 这是{{ settings.fontSize }}px的字体
            </div>
          </a-space>
        </div>
      </div>

      <a-divider />

      <!-- 播放设置 -->
      <div class="setting-section">
        <h3 class="setting-title">
          <icon-play-circle />
          播放设置
        </h3>
        <a-space direction="vertical" :size="12" style="width: 100%">
          <div class="setting-item">
            <div class="item-info">
              <span class="item-label">自动播放下一首</span>
              <span class="item-desc">播放完当前歌曲后自动播放下一首</span>
            </div>
            <a-switch v-model="settings.autoPlayNext" @change="saveSettings" />
          </div>
          <div class="setting-item">
            <div class="item-info">
              <span class="item-label">启用淡入淡出</span>
              <span class="item-desc">歌曲切换时使用淡入淡出效果</span>
            </div>
            <a-switch v-model="settings.enableFade" @change="saveSettings" />
          </div>
          <div class="setting-item">
            <div class="item-info">
              <span class="item-label">显示歌词</span>
              <span class="item-desc">在播放器中显示歌词</span>
            </div>
            <a-switch v-model="settings.showLyrics" @change="saveSettings" />
          </div>
        </a-space>
      </div>

      <a-divider />

      <!-- 音质设置 -->
      <div class="setting-section">
        <h3 class="setting-title">
          <icon-sound />
          音质设置
        </h3>
        <a-radio-group v-model="settings.quality" @change="saveSettings" direction="vertical">
          <a-radio value="standard">标准品质 (128kbps)</a-radio>
          <a-radio value="higher">较高品质 (192kbps)</a-radio>
          <a-radio value="exhigh">极高品质 (320kbps)</a-radio>
          <a-radio value="lossless">无损品质 (FLAC)</a-radio>
          <a-radio value="hires">Hi-Res (高解析度)</a-radio>
        </a-radio-group>
      </div>

      <a-divider />

      <!-- 下载设置 -->
      <div class="setting-section">
        <h3 class="setting-title">
          <icon-download />
          下载设置
        </h3>
        <a-space direction="vertical" :size="12" style="width: 100%">
          <div class="setting-item">
            <div class="item-info">
              <span class="item-label">下载路径</span>
              <span class="item-desc">{{ settings.downloadPath || '默认路径' }}</span>
            </div>
            <a-button size="small" @click="selectDownloadPath">选择</a-button>
          </div>
        </a-space>
      </div>

      <a-divider />

      <!-- 重置按钮 -->
      <div class="setting-section">
        <a-button type="outline" long @click="confirmReset" status="warning">
          <template #icon><icon-refresh /></template>
          恢复默认设置
        </a-button>
      </div>

      <!-- 版本信息 -->
      <div class="setting-section version-info">
        <a-space direction="vertical" :size="4">
          <div class="version-item">
            <span class="label">应用版本：</span>
            <span class="value">v1.0.1</span>
          </div>
          <div class="version-item">
            <span class="label">Developer:</span>
            <span class="value">sluq</span>
          </div>
        </a-space>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconCheck,
  IconRefresh,
  IconPalette,
  IconFontColors,
  IconPlayCircle,
  IconSound,
  IconDownload
} from '@arco-design/web-vue/es/icon'

// 抽屉可见性
const visible = defineModel('visible', { type: Boolean, default: false })

// 默认设置
const defaultSettings = {
  themeColor: 'arcoblue',
  fontSize: 14,
  autoPlayNext: true,
  enableFade: true,
  showLyrics: true,
  quality: 'exhigh',
  downloadPath: ''
}

// 设置状态
const settings = ref({ ...defaultSettings })

// Electron 版本

// 主题颜色选项（使用颜色系列名称）
const themeColors = [
  { name: '拂晓蓝', value: 'arcoblue', color: 'rgb(22, 93, 255)' },
  { name: '极客蓝', value: 'blue', color: 'rgb(52, 145, 250)' },
  { name: '日暮紫', value: 'purple', color: 'rgb(114, 46, 209)' },
  { name: '薄暮粉', value: 'pinkpurple', color: 'rgb(217, 26, 217)' },
  { name: '火山红', value: 'red', color: 'rgb(245, 63, 63)' },
  { name: '日出橙', value: 'orangered', color: 'rgb(247, 114, 52)' },
  { name: '金杯黄', value: 'gold', color: 'rgb(247, 186, 30)' },
  { name: '极光绿', value: 'green', color: 'rgb(0, 180, 42)' },
  { name: '青春蓝', value: 'cyan', color: 'rgb(20, 201, 201)' },
  { name: '优雅灰', value: 'gray', color: 'rgb(134, 144, 156)' }
]

// 更改主题颜色
const changeThemeColor = (colorScheme) => {
  settings.value.themeColor = colorScheme
  applyThemeColor(colorScheme)
  saveSettings()
  Message.success('主题颜色已更改')
}

// 应用主题颜色到全局
const applyThemeColor = (colorScheme) => {
  // 修改 primary 变量指向对应的颜色系列
  for (let i = 1; i <= 10; i++) {
    document.body.style.setProperty(`--primary-${i}`, `var(--${colorScheme}-${i})`)
  }
}

// 更改字体大小
const changeFontSize = (value) => {
  applyFontSize(value)
  saveSettings()
}

// 应用字体大小到全局
const applyFontSize = (size) => {
  document.documentElement.style.setProperty('--base-font-size', size + 'px')
  document.documentElement.style.fontSize = size + 'px'
}

// 保存设置
const saveSettings = () => {
  localStorage.setItem('appSettings', JSON.stringify(settings.value))
}

// 加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('appSettings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      settings.value = { ...defaultSettings, ...parsed }

      // 应用设置
      applyThemeColor(settings.value.themeColor)
      applyFontSize(settings.value.fontSize)
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }
}

// 选择下载路径
const selectDownloadPath = async () => {
  try {
    // 这里可以调用 Electron 的文件选择对话框
    Message.info('此功能需要 Electron API 支持')
    // const path = await window.api.selectDirectory()
    // if (path) {
    //   settings.value.downloadPath = path
    //   saveSettings()
    // }
  } catch (error) {
    console.error('选择路径失败:', error)
  }
}

// 确认重置
const confirmReset = () => {
  Modal.warning({
    title: '确认重置',
    content: '确定要恢复所有默认设置吗？此操作无法撤销。',
    okText: '确认',
    cancelText: '取消',
    onOk: () => {
      resetSettings()
    }
  })
}

// 重置设置
const resetSettings = () => {
  settings.value = { ...defaultSettings }
  applyThemeColor(defaultSettings.themeColor)
  applyFontSize(defaultSettings.fontSize)
  localStorage.removeItem('appSettings')
  Message.success('已恢复默认设置')
}

// 组件挂载时加载设置
onMounted(() => {
  loadSettings()
})

// 暴露方法供外部调用
defineExpose({
  show: () => {
    visible.value = true
  },
  hide: () => {
    visible.value = false
  }
})
</script>

<style lang="scss" scoped>
@import './setting.scss';
</style>
