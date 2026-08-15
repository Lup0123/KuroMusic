<template>
  <n-layout-header class="header draggable-area">
    <div class="header-left">
      <img class="app-logo" width="50" height="50" :src="appIcon" alt="logo" />
      <span class="app-title">Kuromusic</span>
    </div>

    <div class="header-center draggable-area">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索音乐、歌手、专辑..."
        size="large"
        class="no-drag search-input"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>
    </div>

    <div class="header-right">
      <!-- 暗黑模式切换按钮 -->
      <n-button text size="large" class="no-drag" @click="toggleDarkMode">
        <img v-if="!isDarkMode" src="@/assets/icon/sun.png" width="20" height="20" />
        <img v-else src="@/assets/icon/moon.png" width="20" height="20" />
      </n-button>
      <n-button text size="large" class="no-drag" @click="handleuserinfo">
        <template #icon>
          <n-icon><SettingsOutline /></n-icon>
        </template>
      </n-button>

      <!-- 用户按钮 -->
      <n-popover
        v-if="isLoggedIn"
        v-model:show="showUserPopover"
        trigger="click"
        placement="bottom-end"
        :show-arrow="false"
      >
        <template #trigger>
          <div class="user-menu-trigger no-drag">
            <n-avatar
              v-if="userInfo?.avatarUrl"
              round
              size="large"
              class="user-avatar"
              :src="userInfo.avatarUrl"
            />
            <n-icon class="trigger-arrow" size="14"><ChevronDownOutline /></n-icon>
          </div>
        </template>

        <div class="user-profile-card no-drag">
          <div class="profile-top">
            <n-avatar round :size="56" :src="userInfo?.avatarUrl" />
            <div class="profile-main">
              <div class="nickname">{{ userInfo?.nickname || '用户' }}</div>
              <div class="user-meta">UID {{ userInfo?.userId || '-' }}</div>
              <div class="profile-tags">
                <n-tag v-if="userVipTag" size="small" round type="warning" class="vip-tag-chip">
                  {{ userVipTag }}
                </n-tag>
                <n-tag size="small" round class="plain-chip"
                  >等级 {{ userInfo?.level ?? '-' }}</n-tag
                >
              </div>
            </div>
          </div>

          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-value">{{ formatProfileCount(userInfo?.follows) }}</span>
              <span class="stat-label">关注</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ formatProfileCount(userInfo?.followeds) }}</span>
              <span class="stat-label">粉丝</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ formatProfileCount(userInfo?.playlistCount) }}</span>
              <span class="stat-label">歌单</span>
            </div>
          </div>

          <div class="profile-signature">{{ userInfo?.signature || '听点喜欢的，过好今天。' }}</div>

          <div class="user-quick-tip">
            <span class="tip-dot"></span><span>登录态已同步，支持云端歌单管理</span>
          </div>

          <div class="user-popover-actions">
            <n-button type="error" tertiary block @click="handleLogoutFromPopover"
              >退出登录</n-button
            >
          </div>
        </div>
      </n-popover>
      <n-button v-else text size="large" class="no-drag" @click="openLoginModal">
        <template #icon>
          <n-icon><PersonOutline /></n-icon>
        </template>
      </n-button>

      <!-- 自定义窗口控制按钮 -->
      <div class="window-controls">
        <n-button class="no-drag" text size="large" @click="minimizeWindow">
          <template #icon>
            <n-icon><RemoveOutline /></n-icon>
          </template>
        </n-button>
        <n-button class="no-drag" text size="large" @click="maximizeWindow">
          <template #icon>
            <n-icon><ExpandOutline /></n-icon>
          </template>
        </n-button>
        <n-button class="no-drag" text size="large" @click="closeWindow">
          <template #icon>
            <n-icon><CloseOutline /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <n-modal
      v-model:show="showLoginModal"
      preset="card"
      :style="{ width: '820px' }"
      :bordered="false"
      class="login-modal-wrapper"
      @close="handleCloseLoginModal"
    >
      <template v-if="showLoginModal">
        <div class="login-container">
        <!-- 左侧品牌区 -->
        <div class="login-brand">
          <div class="brand-content">
            <img class="brand-logo" :src="appIcon" alt="Kuromusic" />
            <h1 class="brand-title">Kuromusic</h1>
            <p class="brand-subtitle">发现更多好音乐</p>
            <div class="brand-features">
              <div class="feature-item">
                <n-icon><HeadsetOutline /></n-icon>
                <span>海量曲库</span>
              </div>
              <div class="feature-item">
                <n-icon><HeartOutline /></n-icon>
                <span>个性推荐</span>
              </div>
              <div class="feature-item">
                <n-icon><DownloadOutline /></n-icon>
                <span>无损下载</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧登录区 -->
        <div class="login-form-section">
          <div class="login-header">
            <h2>欢迎回来</h2>
            <p>登录以享受完整功能</p>
          </div>
          <!-- 登录方式切换 -->
          <n-radio-group v-model:value="loginTab" class="login-method-switch">
            <n-radio-button value="qrcode">扫码登录</n-radio-button>
            <n-radio-button value="password">账号登录</n-radio-button>
          </n-radio-group>

          <!-- 二维码登录 -->
          <div v-if="loginTab === 'qrcode'" class="qrcode-section">
            <div class="qrcode-box">
              <div v-if="qrCodeImg" class="qrcode-wrapper">
                <img :src="qrCodeImg" alt="二维码" class="qrcode-img" />
                <div v-if="qrCodeStatus === 'scanned'" class="qrcode-overlay scanned">
                  <n-icon size="40" color="#18a058"><CheckmarkCircleOutline /></n-icon>
                  <span>扫码成功</span>
                  <p>请在手机上确认登录</p>
                </div>
                <div v-if="qrCodeStatus === 'expired'" class="qrcode-overlay expired">
                  <n-icon size="32"><RefreshOutline /></n-icon>
                  <span>二维码已过期</span>
                  <n-button type="primary" size="small" @click="refreshQrCode">点击刷新</n-button>
                </div>
              </div>
              <div v-else class="qrcode-placeholder">
                <n-spin v-if="qrCodeLoading" size="large" />
                <template v-else>
                  <n-icon size="48" color="#ccc"><QrCodeOutline /></n-icon>
                  <n-button type="primary" @click="refreshQrCode">获取二维码</n-button>
                </template>
              </div>
            </div>
            <p class="qrcode-hint">
              <n-icon><PhonePortraitOutline /></n-icon>
              使用网易云音乐 App 扫码登录
            </p>
          </div>

          <!-- 账号登录 -->
          <div v-else class="account-section">
            <n-form :model="loginForm" class="account-form">
              <!-- 账号类型切换 -->
              <div class="account-type-switch">
                <span
                  :class="['type-option', { active: loginType === 'phone' }]"
                  @click="loginType = 'phone'"
                  >手机号登录</span
                >
                <span class="type-divider">|</span>
                <span
                  :class="['type-option', { active: loginType === 'email' }]"
                  @click="loginType = 'email'"
                  >邮箱登录</span
                >
              </div>

              <template v-if="loginType === 'phone'">
                <n-form-item>
                  <n-input-group>
                    <n-select
                      v-model:value="loginForm.countryCode"
                      :options="countryCodeOptions"
                      style="width: 100px"
                    />
                    <n-input
                      v-model:value="loginForm.phone"
                      placeholder="请输入手机号"
                      clearable
                      style="flex: 1"
                    >
                      <template #prefix>
                        <n-icon><CallOutline /></n-icon>
                      </template>
                    </n-input>
                  </n-input-group>
                </n-form-item>

                <n-form-item v-if="phoneLoginMode === 'password'" class="password-field">
                  <n-input
                    v-model:value="loginForm.password"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入密码"
                    clearable
                  >
                    <template #prefix>
                      <n-icon><LockClosedOutline /></n-icon>
                    </template>
                  </n-input>
                  <span class="switch-login-mode" @click="phoneLoginMode = 'captcha'"
                    >验证码登录</span
                  >
                </n-form-item>

                <n-form-item v-else class="captcha-field">
                  <n-input-group>
                    <n-input v-model:value="loginForm.captcha" placeholder="请输入验证码" clearable>
                      <template #prefix>
                        <n-icon><ShieldCheckmarkOutline /></n-icon>
                      </template>
                    </n-input>
                    <n-button :disabled="smsCountdown > 0" @click="handleSendCaptcha">
                      {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
                    </n-button>
                  </n-input-group>
                  <span class="switch-login-mode" @click="phoneLoginMode = 'password'"
                    >密码登录</span
                  >
                </n-form-item>
              </template>

              <template v-else>
                <n-form-item>
                  <n-input-group>
                    <n-input
                      v-model:value="loginForm.emailPrefix"
                      placeholder="请输入邮箱前缀"
                      clearable
                      style="flex: 1"
                    >
                      <template #prefix>
                        <n-icon><MailOutline /></n-icon>
                      </template>
                    </n-input>
                    <n-input-group-label>@163.com</n-input-group-label>
                  </n-input-group>
                </n-form-item>

                <n-form-item>
                  <n-input
                    v-model:value="loginForm.password"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入密码"
                    clearable
                  >
                    <template #prefix>
                      <n-icon><LockClosedOutline /></n-icon>
                    </template>
                  </n-input>
                </n-form-item>
              </template>

              <n-form-item class="submit-item">
                <n-button
                  type="primary"
                  block
                  size="large"
                  :loading="loginLoading"
                  class="login-btn"
                  @click="handlePasswordLogin"
                >
                  {{
                    loginType === 'phone' && phoneLoginMode === 'captcha' ? '验证码登录' : '登录'
                  }}
                </n-button>
              </n-form-item>
            </n-form>
          </div>
        </div>
        </div>
      </template>
    </n-modal>

    <!-- 设置抽屉 -->
    <SettingDrawer v-model:visible="showSettingsDrawer" />
  </n-layout-header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, inject, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/searchStore'
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { NIcon } from 'naive-ui'
import { ROUTE_NAMES } from '@/router/routeNames'
import { useAppFeedback } from '@/composables/useAppFeedback'
import {
  SearchOutline,
  SettingsOutline,
  PersonOutline,
  ChevronDownOutline,
  RemoveOutline,
  ExpandOutline,
  CloseOutline,
  CheckmarkCircleOutline,
  RefreshOutline,
  QrCodeOutline,
  PhonePortraitOutline,
  CallOutline,
  LockClosedOutline,
  ShieldCheckmarkOutline,
  MailOutline,
  HeadsetOutline,
  HeartOutline,
  DownloadOutline
} from '@vicons/ionicons5'
import appIcon from '@/assets/icon/icon.png'
const SettingDrawer = defineAsyncComponent(() => import('@/components/content/setting/setting.vue'))

const router = useRouter()
const feedback = useAppFeedback()

const searchStore = useSearchStore()
const { setSearchKeyword } = searchStore

const userStore = useUserStore()
const { userInfo, isLoggedIn, loginLoading, qrCodeImg, qrCodeStatus } = storeToRefs(userStore)

// 注入主题切换方法
const isDarkModeInjected = inject('isDarkMode')
const toggleDarkModeInjected = inject('toggleDarkMode')

const userVipTag = computed(() => {
  const info = userInfo.value
  if (!info) return ''
  const vipType = Number(info.vipType ?? -1)
  const isBlackVip = vipType === 110 || Number(info.redVipLevel ?? 0) > 0
  return isBlackVip ? '黑胶VIP' : ''
})

const searchKeyword = ref('')
const isDarkMode = computed(() => isDarkModeInjected?.value ?? false)

const formatProfileCount = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '--'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  return String(n)
}

const showUserPopover = ref(false)

const handleLogoutFromPopover = async () => {
  await handleLogout()
  showUserPopover.value = false
}

// 登录相关状态
const showLoginModal = ref(false)
const loginTab = ref('qrcode')
const loginType = ref('phone')
const phoneLoginMode = ref('password')
const qrCodeLoading = ref(false)
const smsCountdown = ref(0)
const countryCodeOptions = [
  { label: '+86', value: '86' },
  { label: '+852', value: '852' },
  { label: '+853', value: '853' },
  { label: '+886', value: '886' }
]
const loginForm = ref({
  countryCode: '86',
  phone: '',
  emailPrefix: '',
  password: '',
  captcha: ''
})

// 设置抽屉状态
const showSettingsDrawer = ref(false)

// 二维码轮询定时器
let qrCodeTimer = null
let smsTimer = null

const resetLoginForm = () => {
  loginForm.value = { countryCode: '86', phone: '', emailPrefix: '', password: '', captcha: '' }
  phoneLoginMode.value = 'password'
}

const stopSmsCountdown = () => {
  if (smsTimer) {
    clearInterval(smsTimer)
    smsTimer = null
  }
  smsCountdown.value = 0
}

const startSmsCountdown = () => {
  stopSmsCountdown()
  smsCountdown.value = 60
  smsTimer = setInterval(() => {
    if (smsCountdown.value <= 1) {
      stopSmsCountdown()
      return
    }
    smsCountdown.value -= 1
  }, 1000)
}

const isPhoneValid = (phone) => /^\d{5,15}$/.test((phone || '').trim())
const build163Email = () => {
  const prefix = (loginForm.value.emailPrefix || '').trim()
  return prefix ? `${prefix}@163.com` : ''
}

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    feedback.warning('请输入搜索关键词')
    return
  }
  setSearchKeyword(searchKeyword.value.trim())
  router.push({ name: ROUTE_NAMES.SONG_SEARCH })
}

const minimizeWindow = () => {
  window.api?.minimize()
}
const maximizeWindow = () => {
  window.api?.maximize()
}
const closeWindow = () => {
  window.api?.close()
}
const toggleDarkMode = () => {
  toggleDarkModeInjected?.()
}

const refreshQrCode = async () => {
  qrCodeLoading.value = true
  stopQrCodePolling()
  try {
    await userStore.generateQrCode()
    if (qrCodeImg.value) startQrCodePolling()
  } catch (error) {
    console.error('获取二维码失败:', error)
  } finally {
    qrCodeLoading.value = false
  }
}

const startQrCodePolling = () => {
  stopQrCodePolling()
  qrCodeTimer = setInterval(async () => {
    const result = await userStore.checkQrCodeStatus()
    if (result) {
      if (result.status === 'success') {
        stopQrCodePolling()
        showLoginModal.value = false
        feedback.success('登录成功')
      } else if (result.status === 'expired') {
        stopQrCodePolling()
      }
    }
  }, 2000)
}

const stopQrCodePolling = () => {
  if (qrCodeTimer) {
    clearInterval(qrCodeTimer)
    qrCodeTimer = null
  }
}

const handleSendCaptcha = async () => {
  if (!isPhoneValid(loginForm.value.phone)) {
    feedback.warning('请输入正确的手机号')
    return
  }
  const result = await userStore.sendCaptcha(loginForm.value.phone, loginForm.value.countryCode)
  if (result.success) {
    feedback.success('验证码已发送')
    startSmsCountdown()
  } else {
    feedback.error(result.message || '验证码发送失败')
  }
}

const handlePasswordLogin = async () => {
  if (loginType.value === 'phone') {
    if (!isPhoneValid(loginForm.value.phone)) {
      feedback.warning('请输入正确的手机号')
      return
    }
  } else {
    if (!loginForm.value.emailPrefix) {
      feedback.warning('请输入163邮箱前缀')
      return
    }
  }

  let result
  if (loginType.value === 'phone') {
    if (phoneLoginMode.value === 'password') {
      if (!loginForm.value.password) {
        feedback.warning('请输入密码')
        return
      }
      result = await userStore.loginByPhone(
        loginForm.value.phone,
        loginForm.value.password,
        loginForm.value.countryCode
      )
    } else {
      if (!loginForm.value.captcha) {
        feedback.warning('请输入短信验证码')
        return
      }
      result = await userStore.loginByPhoneCaptcha(
        loginForm.value.phone,
        loginForm.value.captcha,
        loginForm.value.countryCode
      )
    }
  } else {
    if (!loginForm.value.password) {
      feedback.warning('请输入密码')
      return
    }
    result = await userStore.loginByEmail(build163Email(), loginForm.value.password)
  }

  if (result.success) {
    showLoginModal.value = false
    feedback.success('登录成功')
    resetLoginForm()
    stopSmsCountdown()
  } else {
    feedback.error(result.message || '登录失败')
  }
}

const handleLogout = async () => {
  const success = await userStore.logout()
  if (success) feedback.success('已退出登录')
}

const handleCloseLoginModal = () => {
  showLoginModal.value = false
  stopQrCodePolling()
  stopSmsCountdown()
  userStore.resetQrCode()
  resetLoginForm()
}

const handleuserinfo = () => {
  showSettingsDrawer.value = true
}

const openLoginModal = () => {
  showLoginModal.value = true
}

onMounted(() => {
  userStore.restoreUserInfo()
})
onUnmounted(() => {
  stopQrCodePolling()
  stopSmsCountdown()
})
</script>

<style scoped lang="scss">
// 顶部导航栏样式
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--n-color);
  border-bottom: 1px solid var(--n-border-color);
  padding: 0 20px;
  height: 60px !important;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  z-index: 1000;
}

.draggable-area {
  -webkit-app-region: drag;
  user-select: none;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--n-text-color);
  letter-spacing: 0.5px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 600px;
  margin: 0 auto;

  .search-input {
    width: 100%;
    max-width: 500px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.window-controls {
  display: flex;
  margin-left: 12px;
  gap: 20px;
}

.user-avatar {
  border: 2px solid rgba(128, 128, 128, 0.2);
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--primary-hover-color, #4080ff);
    transform: scale(1.05);
  }
}

.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  cursor: pointer;
  background: color-mix(in srgb, var(--n-color) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--n-border-color) 70%, transparent);
  transition: all 0.25s ease;

  &:hover {
    background: color-mix(in srgb, var(--n-color-modal) 90%, transparent);
    border-color: color-mix(in srgb, var(--n-primary-color) 30%, var(--n-border-color));
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);

    .trigger-arrow {
      color: var(--n-primary-color);
      transform: translateY(1px);
    }
  }
}

.trigger-arrow {
  color: var(--n-text-color-3);
  transition: all 0.2s ease;
}

:deep(.user-profile-card) {
  width: 100%;
  min-width: 250px;
  padding: 10px;
  border-radius: 12px;
  background:
    radial-gradient(
      circle at 12% 16%,
      color-mix(in srgb, var(--n-primary-color) 14%, transparent),
      transparent 48%
    ),
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--n-color-modal) 92%, transparent),
      var(--n-color)
    );
  border: 1px solid color-mix(in srgb, var(--n-primary-color) 14%, var(--n-border-color));
}

:deep(.profile-top) {
  display: flex;
  gap: 12px;
  align-items: center;

  :deep(.n-avatar) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--n-primary-color) 24%, transparent),
      0 8px 18px rgba(0, 0, 0, 0.16);
  }
}

:deep(.profile-main) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

:deep(.profile-tags) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

:deep(.nickname) {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.user-meta) {
  font-size: 12px;
  color: var(--n-text-color-3);
  font-variant-numeric: tabular-nums;
}

:deep(.vip-tag-chip) {
  :deep(.n-tag__content) {
    font-weight: 700;
  }
}

:deep(.plain-chip) {
  :deep(.n-tag__content) {
    color: var(--n-text-color-2);
  }
}

:deep(.profile-stats) {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in srgb, var(--n-border-color) 90%, transparent);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

:deep(.stat-item) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

:deep(.stat-value) {
  font-size: 13px;
  font-weight: 700;
  color: var(--n-text-color);
  font-variant-numeric: tabular-nums;
}

:deep(.stat-label) {
  font-size: 11px;
  color: var(--n-text-color-3);
}

:deep(.profile-signature) {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in srgb, var(--n-border-color) 90%, transparent);
  font-size: 12px;
  line-height: 1.4;
}

:deep(.user-quick-tip) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--n-text-color-3);
  padding: 6px 12px 8px;
}

:deep(.tip-dot) {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--n-success-color);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--n-success-color) 20%, transparent);
}

:deep(.n-dropdown-menu) {
  border-radius: 14px;
  padding: 8px;
  min-width: 220px;
  border: 1px solid color-mix(in srgb, var(--n-border-color) 85%, transparent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
}

:deep(.n-dropdown-option) {
  border-radius: 10px;
}

:deep(.n-dropdown-option-body) {
  padding: 10px 12px;
}

:deep(.n-dropdown-option--disabled) {
  cursor: default;
}

:deep(.n-dropdown-divider) {
  margin: 8px 4px;
}

:deep(.dropdown-action) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

:deep(.dropdown-action.danger) {
  color: #d03050;
}

// 登录弹窗
.login-modal-wrapper {
  :deep(.n-card) {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  :deep(.n-card-header) {
    display: none;
  }

  :deep(.n-card__content) {
    padding: 0;
  }
}

.login-container {
  display: flex;
  min-height: 520px;
  overflow: hidden;
  width: 100%;
}

.login-brand {
  position: relative;
  width: 300px;
  min-width: 300px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  .brand-content {
    position: relative;
    z-index: 2;
    text-align: center;
    color: white;
    padding: 40px;
  }

  .brand-logo {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    margin-bottom: 20px;
  }

  .brand-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px 0;
    letter-spacing: 1px;
  }

  .brand-subtitle {
    font-size: 14px;
    opacity: 0.9;
    margin: 0 0 32px 0;
  }

  .brand-features {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    opacity: 0.95;
  }
}

.login-form-section {
  flex: 1;
  min-width: 400px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  .login-header {
    text-align: center;
    margin-bottom: 28px;

    h2 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }

    p {
      font-size: 14px;
      color: var(--n-text-color-3);
      margin: 0;
    }
  }

  .login-method-switch {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }
}

.qrcode-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;

  .qrcode-box {
    width: 200px;
    height: 200px;
    border-radius: 16px;
    background: var(--n-card-color);
    border: 1px solid var(--n-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  }

  .qrcode-wrapper {
    position: relative;
    width: 100%;
    height: 100%;

    .qrcode-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 8px;
    }

    .qrcode-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      backdrop-filter: blur(4px);

      &.scanned {
        background: color-mix(in srgb, var(--n-color) 90%, transparent);
        color: var(--n-primary-color);

        span {
          font-size: 16px;
          font-weight: 600;
        }
        p {
          font-size: 12px;
          color: var(--n-text-color-3);
          margin: 0;
        }
      }

      &.expired {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        span {
          font-size: 14px;
          margin: 8px 0;
        }
      }
    }
  }

  .qrcode-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .qrcode-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 20px;
    font-size: 13px;
    color: var(--n-text-color-3);
  }
}

.account-section {
  padding: 0 20px;

  .account-type-switch {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;

    .type-option {
      font-size: 13px;
      color: var(--n-text-color-3);
      cursor: pointer;
      transition: color 0.2s ease;

      &:hover {
        color: var(--n-text-color-2);
      }
      &.active {
        color: var(--primary-color, #165dff);
        font-weight: 500;
      }
    }

    .type-divider {
      color: var(--n-border-color);
    }
  }

  .account-form {
    :deep(.n-form-item) {
      margin-bottom: 16px;
    }
  }

  .password-field,
  .captcha-field {
    position: relative;

    .switch-login-mode {
      position: absolute;
      right: 0;
      bottom: -20px;
      font-size: 12px;
      color: var(--primary-color, #165dff);
      cursor: pointer;

      &:hover {
        color: var(--primary-hover-color, #4080ff);
        text-decoration: underline;
      }
    }
  }

  .submit-item {
    margin-top: 24px;
  }

  .login-btn {
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
  }
}

@media (max-width: 768px) {
  .header {
    padding: 0 12px;
  }
  .header-center {
    display: none;
  }
  .app-title {
    font-size: 16px;
  }
}
</style>
