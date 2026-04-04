<template>
  <n-drawer v-model:show="visible" :width="450" placement="right">
    <n-drawer-content title="设置" closable>
      <div class="settings-content">
        <!-- 主题颜色设置 -->
        <div class="setting-section">
          <h3 class="setting-title">
            <n-icon><ColorPaletteOutline /></n-icon>
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
              <n-icon v-if="settings.themeColor === color.value" color="#fff"
                ><CheckmarkOutline
              /></n-icon>
            </div>
          </div>
        </div>
        <n-divider />
        <!-- 字体大小设置 -->
        <div class="setting-section">
          <h3 class="setting-title">
            <n-icon><TextOutline /></n-icon> 字体大小
          </h3>
          <n-space vertical :size="16" style="width: 100%">
            <n-slider
              v-model:value="settings.fontSize"
              :min="12"
              :max="20"
              :step="1"
              :marks="{ 12: '小', 16: '中', 20: '大' }"
              @update:value="changeFontSize"
            />
            <div class="preview-text" :style="{ fontSize: settings.fontSize + 'px' }">
              预览文本效果 - 这是{{ settings.fontSize }}px 的字体
            </div>
          </n-space>
        </div>
        <n-divider />
        <!-- 播放设置 -->
        <div class="setting-section">
          <h3 class="setting-title">
            <n-icon><PlayCircleOutline /></n-icon> 播放设置
          </h3>
          <n-space vertical :size="12" style="width: 100%">
            <div class="setting-item">
              <div class="item-info">
                <span class="item-label">自动播放下一首</span
                ><span class="item-desc">播放完当前歌曲后自动播放下一首</span>
              </div>
              <n-switch v-model:value="settings.autoPlayNext" @update:value="saveSettings" />
            </div>
            <div class="setting-item">
              <div class="item-info">
                <span class="item-label">启用淡入淡出</span
                ><span class="item-desc">歌曲切换时使用淡入淡出效果</span>
              </div>
              <n-switch v-model:value="settings.enableFade" @update:value="saveSettings" />
            </div>
            <div class="setting-item">
              <div class="item-info">
                <span class="item-label">显示歌词</span
                ><span class="item-desc">在播放器中显示歌词</span>
              </div>
              <n-switch v-model:value="settings.showLyrics" @update:value="saveSettings" />
            </div>
          </n-space>
        </div>
        <n-divider />
        <!-- 音质设置 -->
        <div class="setting-section">
          <h3 class="setting-title">
            <n-icon><VolumeHighOutline /></n-icon> 音质设置
          </h3>
          <n-radio-group v-model:value="settings.quality" @update:value="saveSettings">
            <n-space vertical>
              <n-radio value="standard">标准音质 (128kbps)</n-radio>
              <n-radio value="higher">较高音质 (192kbps)</n-radio>
              <n-radio value="exhigh">极高音质 (320kbps)</n-radio>
              <n-radio value="lossless">无损音质 (FLAC)</n-radio>
              <n-radio value="hires">Hi-Res (高解析度)</n-radio>
            </n-space>
          </n-radio-group>
        </div>
        <n-divider />
        <!-- 下载设置 -->
        <div class="setting-section">
          <h3 class="setting-title">
            <n-icon><DownloadOutline /></n-icon> 下载设置
          </h3>
          <n-space vertical :size="12" style="width: 100%">
            <div class="setting-item">
              <div class="item-info">
                <span class="item-label">下载路径</span
                ><span class="item-desc">{{ settings.downloadPath || '默认路径' }}</span>
              </div>
              <n-button size="small" @click="selectDownloadPath">选择</n-button>
            </div>
          </n-space>
        </div>
        <n-divider />
        <div class="setting-section">
          <n-button type="error" block @click="confirmReset"
            ><template #icon
              ><n-icon><RefreshOutline /></n-icon></template
            >恢复默认设置</n-button
          >
        </div>
        <div class="setting-section version-info">
          <n-space vertical :size="4">
            <div class="version-item">
              <span class="label">应用版本：</span><span class="value">v1.1.0</span>
            </div>
            <div class="version-item">
              <span class="label">Developer:</span><span class="value">sluq</span>
            </div>
          </n-space>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import {
  CheckmarkOutline,
  RefreshOutline,
  ColorPaletteOutline,
  TextOutline,
  PlayCircleOutline,
  VolumeHighOutline,
  DownloadOutline
} from '@vicons/ionicons5'

const visible = defineModel('visible', { type: Boolean, default: false })
const message = useMessage()
const dialog = useDialog()
const setPrimaryColor = inject('setPrimaryColor')

const defaultSettings = {
  themeColor: 'arcoblue',
  fontSize: 14,
  autoPlayNext: true,
  enableFade: true,
  showLyrics: true,
  quality: 'exhigh',
  downloadPath: ''
}
const settings = ref({ ...defaultSettings })

const themeColors = [
  { name: '拂晓蓝', value: 'arcoblue', color: '#165DFF', hover: '#4080FF' },
  { name: '极客蓝', value: 'blue', color: '#3491FA', hover: '#5AA9FA' },
  { name: '暮光紫', value: 'purple', color: '#722ED1', hover: '#9254DE' },
  { name: '浪漫粉', value: 'pinkpurple', color: '#D91AD9', hover: '#EA3FEA' },
  { name: '火山红', value: 'red', color: '#F53F3F', hover: '#F76560' },
  { name: '日出橙', value: 'orangered', color: '#F77234', hover: '#FF9A2E' },
  { name: '金盏黄', value: 'gold', color: '#F7BA1E', hover: '#F9CC45' },
  { name: '极光绿', value: 'green', color: '#00B42A', hover: '#23C343' },
  { name: '青春青', value: 'cyan', color: '#14C9C9', hover: '#33D4CF' },
  { name: '雅致灰', value: 'gray', color: '#86909C', hover: '#A4ACB5' }
]
const themeColorMap = Object.fromEntries(themeColors.map((item) => [item.value, item]))

const changeThemeColor = (colorScheme) => {
  settings.value.themeColor = colorScheme
  applyThemeColor(colorScheme)
  saveSettings()
  message.success('主题颜色已更改')
}
const applyThemeColor = (colorScheme) => {
  const targetThemeColor = themeColorMap[colorScheme] || themeColorMap.arcoblue
  if (setPrimaryColor) setPrimaryColor(targetThemeColor.color, targetThemeColor.hover)
}
const changeFontSize = (value) => {
  settings.value.fontSize = value
  applyFontSize(value)
  saveSettings()
}
const applyFontSize = (size) => {
  document.documentElement.style.setProperty('--base-font-size', size + 'px')
  document.documentElement.style.fontSize = size + 'px'
}
const saveSettings = () => {
  localStorage.setItem('appSettings', JSON.stringify(settings.value))
}
const loadSettings = () => {
  const saved = localStorage.getItem('appSettings')
  if (saved) {
    try {
      settings.value = { ...defaultSettings, ...JSON.parse(saved) }
      applyThemeColor(settings.value.themeColor)
      applyFontSize(settings.value.fontSize)
    } catch (e) {
      console.error('加载设置失败:', e)
    }
  }
}
const selectDownloadPath = async () => {
  message.info('此功能需要 Electron API 支持')
}
const confirmReset = () => {
  dialog.warning({
    title: '确认重置',
    content: '确定要恢复所有默认设置吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: resetSettings
  })
}
const resetSettings = () => {
  settings.value = { ...defaultSettings }
  applyThemeColor(defaultSettings.themeColor)
  applyFontSize(defaultSettings.fontSize)
  localStorage.removeItem('appSettings')
  message.success('已恢复默认设置')
}
onMounted(() => {
  loadSettings()
})
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
.settings-content {
  padding: 0;

  .setting-section {
    margin-bottom: 80px;

    .setting-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--n-text-color);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      svg {
        font-size: 18px;
      }
    }

    // 主题颜色网格
    .theme-colors {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;

      .color-option {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 3px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        &:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        &.active {
          border-color: var(--n-text-color);
          box-shadow: 0 0 0 4px rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.15);
          transform: scale(1.1);

          .check-icon {
            color: #fff;
            font-size: 22px;
            font-weight: bold;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
          }
        }
      }
    }

    // 字体大小控制
    .font-size-control {
      .slider-wrapper {
        padding: 0 8px;
        margin-bottom: 8px;
      }

      .preview-text {
        padding: 20px;
        background: var(--n-hover-color);
        border-radius: 12px;
        text-align: center;
        color: var(--n-text-color);
        transition: font-size 0.3s ease;
        font-weight: 500;
        border: 2px dashed var(--n-border-color);
      }
    }

    // 璁剧疆椤?
    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: var(--n-hover-color);
      border-radius: 12px;
      transition: all 0.2s ease;
      border: 1px solid transparent;

      &:hover {
        background: var(--n-pressed-color);
        border-color: var(--n-border-color);
        transform: translateX(4px);
      }

      .item-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .item-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--n-text-color);
        }

        .item-desc {
          font-size: 12px;
          color: var(--n-text-color-3);
        }
      }
    }

    // 鐗堟湰淇℃伅
    &.version-info {
      padding: 16px;
      background: var(--n-hover-color);
      border-radius: 12px;
      border: 1px solid var(--n-border-color);

      .version-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;

        .label {
          color: var(--n-text-color-2);
        }

        .value {
          color: var(--n-text-color);
          font-weight: 500;
          font-family: 'Consolas', 'Monaco', monospace;
        }
      }
    }
  }

  // Radio Group 样式优化
  :deep(.ant-radio-group) {
    width: 100%;

    .ant-radio {
      padding: 12px 16px;
      background: var(--n-hover-color);
      border-radius: 8px;
      margin-bottom: 8px;
      transition: all 0.2s ease;
      border: 1px solid transparent;

      &:hover {
        background: var(--n-pressed-color);
        border-color: var(--n-border-color);
      }

      &.ant-radio-checked {
        background: rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.1);
        border-color: var(--n-primary-color);
      }
    }
  }

  // Slider 样式优化
  :deep(.ant-slider) {
    .ant-slider-line,
    .ant-slider-road,
    .ant-slider-rail {
      background-color: var(--n-pressed-color);
      background-image: none;
    }

    .ant-slider-track {
      background-image: none;
      z-index: 1;
    }

    .ant-slider-track::before,
    .ant-slider-bar::before {
      background-image: none;
    }

    .ant-slider-btn {
      border-color: var(--n-primary-color);
      box-shadow: 0 2px 8px rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.3);

      &:hover {
        transform: scale(1.2);
      }
    }

    .ant-slider-marks-text {
      font-size: 12px;
      color: var(--n-text-color-2);
    }
  }

  // Switch 样式优化
  :deep(.ant-switch) {
    &.ant-switch-checked {
      background-color: var(--n-primary-color);
    }
  }

  // Button 样式优化
  :deep(.ant-btn-outline) {
    border-width: 2px;
    font-weight: 500;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}

// Drawer 整体样式
:deep(.ant-drawer) {
  .ant-drawer-header {
    border-bottom: 2px solid var(--n-border-color);
    padding: 20px 24px;

    .ant-drawer-title {
      font-size: 20px;
      font-weight: 600;
    }
  }

  .ant-drawer-body {
    padding: 24px;
  }
}
</style>
