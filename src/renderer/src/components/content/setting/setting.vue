<template>
  <n-config-provider :theme-overrides="settingThemeOverrides">
    <n-drawer v-model:show="visible" :width="450" placement="right" class="glass-setting-drawer">
      <n-drawer-content title="设置" closable :native-scrollbar="false">
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
          <!-- 界面缩放 -->
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><TextOutline /></n-icon> 界面缩放
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">缩放比例</span
                  ><span class="item-desc"
                    >整体放大或缩小界面，AI 助手窗口同步。快捷键 Ctrl + = / Ctrl + - / Ctrl +
                    0</span
                  >
                </div>
                <n-radio-group
                  :value="uiZoom"
                  size="small"
                  aria-label="界面缩放比例"
                  @update:value="changeUiZoom"
                >
                  <n-radio-button v-for="level in uiZoomLevels" :key="level" :value="level">
                    {{ Math.round(level * 100) }}%
                  </n-radio-button>
                </n-radio-group>
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
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">歌词字号</span
                  ><span class="item-desc"
                    >调整歌词页的文字大小（{{ settings.lyricFontSize }}）</span
                  >
                </div>
                <n-slider
                  v-model:value="settings.lyricFontSize"
                  :min="14"
                  :max="32"
                  :step="2"
                  style="width: 160px"
                  @update:value="saveSettings"
                />
              </div>
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">首页歌单显示</span
                  ><span class="item-desc">网格铺满 或 横向货架滑动</span>
                </div>
                <n-radio-group
                  v-model:value="settings.playlistLayout"
                  size="small"
                  @update:value="saveSettings"
                >
                  <n-radio-button value="grid">网格</n-radio-button>
                  <n-radio-button value="shelf">横向</n-radio-button>
                </n-radio-group>
              </div>
            </n-space>
          </div>
          <n-divider />
          <!-- 首页显示 -->
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><PlayCircleOutline /></n-icon> 首页显示
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div v-for="item in homeSectionOptions" :key="item.key" class="setting-item">
                <div class="item-info">
                  <span class="item-label">{{ item.label }}</span
                  ><span class="item-desc">{{ item.desc }}</span>
                </div>
                <n-switch
                  v-model:value="settings.homeSections[item.key]"
                  @update:value="saveSettings"
                />
              </div>
            </n-space>
          </div>
          <n-divider />
          <!-- 全局快捷键 -->
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><KeypadOutline /></n-icon> 全局快捷键
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">启用全局快捷键</span
                  ><span class="item-desc">应用在后台或最小化时也能响应快捷键</span>
                </div>
                <n-switch
                  v-model:value="settings.globalShortcutsEnabled"
                  @update:value="onGlobalShortcutsToggle"
                />
              </div>
              <div
                v-for="(label, command) in globalShortcutLabels"
                :key="command"
                class="setting-item"
                :class="{ recording: recordingFor === command }"
                @click="startRecording(command)"
              >
                <div class="item-info">
                  <span class="item-label">{{ label }}</span>
                  <span class="item-desc shortcut-value">
                    <n-tag
                      size="small"
                      :type="recordingFor === command ? 'warning' : 'default'"
                      :bordered="false"
                    >
                      {{
                        recordingFor === command
                          ? '请按下快捷键…'
                          : formatAccelerator(settings.globalShortcuts[command])
                      }}
                    </n-tag>
                  </span>
                </div>
                <n-space :size="8">
                  <n-button
                    size="small"
                    :type="recordingFor === command ? 'warning' : 'default'"
                    @click.stop="startRecording(command)"
                  >
                    {{ recordingFor === command ? '监听中' : '录制' }}
                  </n-button>
                  <n-button size="small" @click.stop="clearShortcut(command)">清除</n-button>
                </n-space>
              </div>
            </n-space>
          </div>
          <n-divider />
          <!-- 桌面设置 -->
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><DesktopOutline /></n-icon> 桌面设置
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">开机自启</span
                  ><span class="item-desc">登录系统后自动启动 Kuromusic</span>
                </div>
                <n-switch
                  :value="settings.autoLaunch"
                  :loading="autoLaunchLoading"
                  @update:value="onAutoLaunchToggle"
                />
              </div>
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">关闭时最小化到托盘</span
                  ><span class="item-desc">点击关闭按钮时隐藏到托盘，不退出应用</span>
                </div>
                <n-switch
                  v-model:value="settings.closeToTray"
                  @update:value="onCloseToTrayToggle"
                />
              </div>
            </n-space>
          </div>
          <n-divider />
          <!-- 软件更新 -->
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><CloudDownloadOutline /></n-icon> 软件更新
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">自动检查更新</span
                  ><span class="item-desc">应用启动后自动检查新版本</span>
                </div>
                <n-switch
                  v-model:value="settings.autoCheckUpdate"
                  @update:value="onAutoCheckUpdateToggle"
                />
              </div>
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">检查更新</span>
                  <span class="item-desc">{{ updateStatusText }}</span>
                </div>
                <n-space :size="8">
                  <n-button size="small" :loading="updateChecking" @click="handleCheckUpdate">
                    检查更新
                  </n-button>
                  <n-button
                    v-if="updateState?.status === 'downloaded'"
                    size="small"
                    type="primary"
                    @click="handleQuitAndInstall"
                  >
                    立即重启安装
                  </n-button>
                </n-space>
              </div>
            </n-space>
          </div>
          <n-divider />
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><SparklesOutline /></n-icon> AI Provider
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <n-input
                v-model:value="settings.aiApiKey"
                type="password"
                show-password-on="click"
                placeholder="填写 Alibaba API Key"
                @update:value="saveSettings"
              />
              <n-input
                v-model:value="settings.aiModel"
                placeholder="模型（如 qwen-plus）"
                @update:value="saveSettings"
              />
              <n-input
                v-model:value="settings.aiBaseUrl"
                placeholder="Base URL"
                @update:value="saveSettings"
              />
            </n-space>
          </div>
          <div class="setting-section">
            <h3 class="setting-title">
              <n-icon><SparklesOutline /></n-icon> AI 偏好记忆
            </h3>
            <n-space vertical :size="12" style="width: 100%">
              <div class="setting-item">
                <div class="item-info">
                  <span class="item-label">行为数据采集</span>
                  <span class="item-desc"
                    >记录播放 / 收藏 / 跳过等行为用于优化 AI 推荐，仅保存在本地</span
                  >
                </div>
                <n-switch :value="behaviorEnabled" @update:value="handleBehaviorToggle" />
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
                <span class="label">应用版本：</span><span class="value">v1.2.0</span>
              </div>
              <div class="version-item">
                <span class="label">Developer:</span><span class="value">sluq</span>
              </div>
            </n-space>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </n-config-provider>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, inject } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import {
  CheckmarkOutline,
  RefreshOutline,
  ColorPaletteOutline,
  TextOutline,
  PlayCircleOutline,
  VolumeHighOutline,
  DownloadOutline,
  SparklesOutline,
  KeypadOutline,
  DesktopOutline,
  CloudDownloadOutline
} from '@vicons/ionicons5'
import {
  DEFAULT_GLOBAL_SHORTCUTS,
  GLOBAL_SHORTCUT_COMMANDS,
  syncGlobalShortcuts
} from '@/services/player/globalShortcuts'
import { keydownToAccelerator, formatAccelerator } from '@/utils/shortcut'
import {
  applyAutoLaunch,
  fetchAutoLaunchStatus,
  syncAutoCheckUpdate,
  syncCloseToTray
} from '@/services/desktopSettings'

const visible = defineModel('visible', { type: Boolean, default: false })
const message = useMessage()
const dialog = useDialog()
const setPrimaryColor = inject('setPrimaryColor')

// 设置抽屉：玻璃底跟随明暗主题（文字/控件由主题决定）
const settingThemeOverrides = {
  Drawer: {
    color: 'var(--glass-panel-bg, rgba(24, 26, 32, 0.9))'
  }
}

const defaultSettings = {
  themeColor: 'arcoblue',
  autoPlayNext: true,
  enableFade: true,
  showLyrics: true,
  lyricFontSize: 22,
  playlistLayout: 'grid',
  homeSections: {
    dailySongs: true,
    newSongs: true,
    recommendPlaylists: true,
    personalized: true,
    topPlaylists: true
  },
  globalShortcutsEnabled: true,
  globalShortcuts: { ...DEFAULT_GLOBAL_SHORTCUTS },
  autoLaunch: false,
  closeToTray: true,
  autoCheckUpdate: true,
  quality: 'exhigh',
  downloadPath: '',
  aiApiKey: '',
  aiModel: 'qwen-plus',
  aiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}
const settings = ref({ ...defaultSettings })

const homeSectionOptions = [
  { key: 'dailySongs', label: '每日推荐歌曲', desc: '每日更新的推荐歌曲横向列表' },
  { key: 'newSongs', label: '新歌速递', desc: '最新发布的热门歌曲榜' },
  { key: 'recommendPlaylists', label: '每日推荐歌单', desc: '根据口味推荐的歌单' },
  { key: 'personalized', label: '为你推荐 / 精选歌单', desc: '个性化推荐歌单' },
  { key: 'topPlaylists', label: '热门歌单', desc: '最受欢迎的精选歌单' }
]
const behaviorEnabled = ref(true)

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
// 界面缩放由主进程持久化并应用到所有窗口，这里只负责展示与切换
const uiZoomLevels = ref([0.9, 1, 1.1, 1.25])
const uiZoom = ref(1)
let unsubscribeUiZoom = null
const loadUiZoom = async () => {
  try {
    const result = await window.api?.getUiZoom?.()
    if (Array.isArray(result?.levels) && result.levels.length) uiZoomLevels.value = result.levels
    if (typeof result?.factor === 'number') uiZoom.value = result.factor
  } catch (error) {
    console.error('读取界面缩放失败:', error)
  }
}
const changeUiZoom = async (factor) => {
  try {
    uiZoom.value = (await window.api?.setUiZoom?.(factor)) ?? factor
  } catch (error) {
    console.error('设置界面缩放失败:', error)
  }
}
const globalShortcutLabels = GLOBAL_SHORTCUT_COMMANDS
const recordingFor = ref(null)

const startRecording = (command) => {
  recordingFor.value = command
  message.info('请按下新的快捷键（Esc 取消，Backspace 清除）')
}
const stopRecording = () => {
  recordingFor.value = null
}
const handleRecordKeydown = (event) => {
  if (!recordingFor.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    stopRecording()
    return
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    settings.value.globalShortcuts[recordingFor.value] = ''
    stopRecording()
    saveSettings()
    applyGlobalShortcuts()
    return
  }
  const accelerator = keydownToAccelerator(event)
  if (!accelerator) return
  event.preventDefault()
  settings.value.globalShortcuts[recordingFor.value] = accelerator
  stopRecording()
  saveSettings()
  applyGlobalShortcuts()
}
const clearShortcut = (command) => {
  settings.value.globalShortcuts[command] = ''
  saveSettings()
  applyGlobalShortcuts()
}
const onGlobalShortcutsToggle = () => {
  saveSettings()
  applyGlobalShortcuts()
}
const autoLaunchLoading = ref(false)
const onAutoLaunchToggle = async (value) => {
  autoLaunchLoading.value = true
  try {
    const result = await applyAutoLaunch(value)
    if (result?.ok) {
      settings.value.autoLaunch = result.enabled !== false
      saveSettings()
      message.success(result.enabled ? '已开启开机自启' : '已关闭开机自启')
    } else if (result?.reason === 'unsupported-platform') {
      settings.value.autoLaunch = false
      message.warning('当前系统不支持开机自启')
    } else {
      settings.value.autoLaunch = false
      message.error('开机自启设置失败')
    }
  } finally {
    autoLaunchLoading.value = false
  }
}
const onCloseToTrayToggle = () => {
  saveSettings()
  syncCloseToTray(settings.value)
}
const updateState = ref(null)
const updateChecking = ref(false)
let unsubscribeUpdateStatus = null
const handleUpdateStatus = (payload) => {
  updateState.value = payload || null
  if (payload?.status === 'checking') updateChecking.value = true
  else if (['available', 'not-available', 'downloaded', 'error'].includes(payload?.status)) {
    updateChecking.value = false
  }
}
const updateStatusText = computed(() => {
  const st = updateState.value
  if (!st) return '等待检查'
  switch (st.status) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 v${st.version}，正在下载`
    case 'downloading':
      return `正在下载 ${st.percent}%`
    case 'downloaded':
      return `新版本 v${st.version} 已就绪`
    case 'not-available':
      return `已是最新版本 v${st.version}`
    case 'error':
      return `检查失败：${st.message || '未知错误'}`
    default:
      return '等待检查'
  }
})
const handleCheckUpdate = async () => {
  updateChecking.value = true
  updateState.value = { status: 'checking' }
  await window.api?.checkForUpdates?.(false)
}
const handleQuitAndInstall = async () => {
  await window.api?.quitAndInstallUpdate?.()
}
const onAutoCheckUpdateToggle = () => {
  saveSettings()
  syncAutoCheckUpdate(settings.value)
}
const applyGlobalShortcuts = async () => {
  const result = await syncGlobalShortcuts(settings.value)
  if (!result || result.disabled) return
  const failed = Object.entries(result).filter(
    ([, item]) => item?.ok === false && (item.reason === 'conflict' || item.reason === 'invalid')
  )
  if (failed.length > 0) {
    const names = failed.map(([command]) => globalShortcutLabels[command] || command).join('、')
    message.warning(`部分快捷键注册失败（可能被其他应用占用）：${names}`)
  }
}
const saveSettings = () => {
  localStorage.setItem('appSettings', JSON.stringify(settings.value))
  // 歌词页读取独立的 lyricFontSize 键，这里同步写入
  localStorage.setItem('lyricFontSize', String(settings.value.lyricFontSize ?? 22))
  // 通知同窗口的其它组件（如首页）设置已变更，实时生效
  window.dispatchEvent(new Event('app-settings-changed'))

  if (window.api?.setAiProviderConfig) {
    window.api.setAiProviderConfig({
      apiKey: settings.value.aiApiKey,
      model: settings.value.aiModel,
      baseUrl: settings.value.aiBaseUrl
    })
  }

  if (window.api?.ragIndexPreference) {
    void window.api.ragIndexPreference({
      id: 'app-ai-settings',
      title: 'AI 设置偏好',
      summary: [
        `模型: ${settings.value.aiModel || 'qwen-plus'}`,
        `接口: ${settings.value.aiBaseUrl || '默认 Base URL'}`,
        `音质: ${settings.value.quality || 'exhigh'}`,
        `自动播放下一首: ${settings.value.autoPlayNext ? '开启' : '关闭'}`,
        `淡入淡出: ${settings.value.enableFade ? '开启' : '关闭'}`,
        `显示歌词: ${settings.value.showLyrics ? '开启' : '关闭'}`
      ].join('；'),
      keywords: ['AI', '设置', settings.value.aiModel, settings.value.quality].filter(Boolean)
    })
  }
}
const loadSettings = () => {
  const saved = localStorage.getItem('appSettings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      settings.value = {
        ...defaultSettings,
        ...parsed,
        homeSections: { ...defaultSettings.homeSections, ...(parsed.homeSections || {}) }
      }
      applyThemeColor(settings.value.themeColor)
    } catch (e) {
      console.error('加载设置失败:', e)
    }
  }

  if (window.api?.getAutoLaunch) {
    fetchAutoLaunchStatus().then((res) => {
      if (res?.ok && typeof res.enabled === 'boolean') {
        settings.value.autoLaunch = res.enabled
        localStorage.setItem('appSettings', JSON.stringify(settings.value))
      }
    })
  }

  if (window.api?.getAiProviderConfig) {
    window.api.getAiProviderConfig().then((res) => {
      if (res?.success && res.data) {
        settings.value.aiApiKey = res.data.apiKey || settings.value.aiApiKey
        settings.value.aiModel = res.data.model || settings.value.aiModel
        settings.value.aiBaseUrl = res.data.baseUrl || settings.value.aiBaseUrl
      }
    })
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
  changeUiZoom(1)
  localStorage.removeItem('appSettings')
  applyGlobalShortcuts()
  syncCloseToTray(settings.value)
  syncAutoCheckUpdate(settings.value)
  applyAutoLaunch(false)
  message.success('已恢复默认设置')
}
onMounted(() => {
  loadSettings()
  window.api
    ?.behaviorGetConfig?.()
    .then((config) => {
      behaviorEnabled.value = Boolean(config?.enabled)
    })
    .catch(() => {})
  window.addEventListener('keydown', handleRecordKeydown, true)
  unsubscribeUpdateStatus = window.api?.onUpdateStatus?.(handleUpdateStatus) || null
  loadUiZoom()
  // 快捷键或其他窗口改了缩放时同步选中状态
  unsubscribeUiZoom =
    window.api?.onUiZoomChanged?.((factor) => {
      uiZoom.value = factor
    }) || null
})

async function handleBehaviorToggle(value) {
  try {
    const config = await window.api?.behaviorSetEnabled?.(Boolean(value))
    behaviorEnabled.value = Boolean(config?.enabled)
    message.success(value ? '已开启 AI 偏好记忆（仅保存在本地）' : '已关闭 AI 偏好记忆')
  } catch {
    behaviorEnabled.value = !value
    message.error('设置失败，请重试')
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleRecordKeydown, true)
  unsubscribeUpdateStatus?.()
  unsubscribeUiZoom?.()
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
        border-color: var(--primary-color, var(--n-primary-color));
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
      border-color: var(--primary-color, var(--n-primary-color));
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
      background-color: var(--primary-color, var(--n-primary-color));
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

<!-- 抽屉被 teleport 到 body，scoped 无法触达，用全局样式补磨砂模糊 -->
<style>
.glass-setting-drawer .n-drawer-content,
.glass-setting-drawer.n-drawer {
  backdrop-filter: blur(28px) saturate(150%);
  border-left: 1px solid var(--glass-panel-border, rgba(255, 255, 255, 0.1));
}
</style>
