<template>
  <a-layout-header class="header draggable-area">
    <div class="header-left">
      <img class="app-logo" width="50" height="50" :src="appIcon" alt="logo" />
      <span class="app-title">Kuromusic</span>
    </div>

    <div class="header-center draggable-area">
      <a-input-search
        v-model="searchKeyword"
        placeholder="搜索音乐、歌手、专辑..."
        size="large"
        class="no-drag"
        allow-clear
        style="width: 400px"
        @press-enter="handleSearch"
        @clear="handleClearSearch"
        @search="handleSearch"
      >
        <template #prefix>
          <icon-search />
        </template>
      </a-input-search>
    </div>

    <div class="header-right">
      <!-- 暗黑模式切换按钮 -->
      <a-button type="text" size="large" class="no-drag" @click="toggleDarkMode">
        <template #icon>
          <icon-sun v-if="isDarkMode" />
          <icon-moon v-else />
        </template>
      </a-button>
      <a-button type="text" size="large" class="no-drag" @click="handleuserinfo">
        <template #icon>
          <icon-settings />
        </template>
      </a-button>

      <!-- 用户按钮 -->
      <a-dropdown v-if="isLoggedIn" trigger="click">
        <a-avatar :size="32" class="user-avatar no-drag" style="cursor: pointer">
          <img v-if="userInfo?.avatarUrl" :src="userInfo.avatarUrl" alt="avatar" />
          <icon-user v-else />
        </a-avatar>
        <template #content>
          <a-doption>
            <div class="user-info-dropdown">
              <a-avatar :size="48">
                <img v-if="userInfo?.avatarUrl" :src="userInfo.avatarUrl" alt="avatar" />
                <icon-user v-else />
              </a-avatar>
              <div class="user-detail">
                <div class="nickname">{{ userInfo?.nickname || '用户' }}</div>
                <div v-if="userVipTag" class="vip-tag" :class="userVipClass">
                  {{ userVipTag }}
                </div>
              </div>
            </div>
          </a-doption>
          <a-divider style="margin: 4px 0" />
          <a-doption @click="handleLogout">
            <template #icon><icon-export /></template>
            退出登录
          </a-doption>
        </template>
      </a-dropdown>
      <a-button v-else type="text" size="large" class="no-drag" @click="showLoginModal = true">
        <template #icon>
          <icon-user />
        </template>
      </a-button>

      <!-- 自定义窗口控制按钮 -->
      <div class="window-controls">
        <a-button class="no-drag" type="text" size="large" @click="minimizeWindow">
          <template #icon>
            <icon-minus size="30" />
          </template>
        </a-button>
        <a-button class="no-drag" type="text" size="large " @click="maximizeWindow">
          <template #icon>
            <icon-fullscreen />
          </template>
        </a-button>
        <a-button class="no-drag" type="text" size="large" @click="closeWindow">
          <template #icon>
            <icon-close size="30" />
          </template>
        </a-button>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <a-modal
      v-model:visible="showLoginModal"
      :footer="false"
      :width="460"
      :z-index="3000"
      :body-style="{ maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }"
      title="登录 Kuromusic"
      class="login-modal"
      @close="handleCloseLoginModal"
    >
      <div class="login-shell">
        <a-tabs v-model:active-key="loginTab" class="login-tabs">
          <!-- 二维码登录 -->
          <a-tab-pane key="qrcode" title="二维码登录">
            <div class="qrcode-login">
              <div class="qrcode-container">
                <div v-if="qrCodeImg" class="qrcode-wrapper">
                  <img :src="qrCodeImg" alt="二维码" class="qrcode-img" />
                  <div v-if="qrCodeStatus === 'scanned'" class="qrcode-mask scanned">
                    <icon-check-circle-fill :size="46" />
                    <span>已扫码，请在手机上确认</span>
                  </div>
                  <div v-if="qrCodeStatus === 'expired'" class="qrcode-mask expired">
                    <span>二维码已过期</span>
                    <a-button type="primary" size="small" @click="refreshQrCode">刷新</a-button>
                  </div>
                </div>
                <div v-else class="qrcode-placeholder">
                  <a-spin v-if="qrCodeLoading" tip="正在获取二维码..." />
                  <div v-else class="qrcode-empty">
                    <icon-qrcode :size="56" style="color: var(--color-text-4)" />
                    <a-button type="primary" @click="refreshQrCode">获取登录二维码</a-button>
                  </div>
                </div>
              </div>
              <p class="qrcode-tip">请使用网易云音乐 App 扫码登录</p>
            </div>
          </a-tab-pane>

          <!-- 账号登录 -->
          <a-tab-pane key="password" title="账号登录">
            <a-form :model="loginForm" layout="vertical" class="login-form">
              <a-form-item class="compact-item" label="账号类型">
                <a-radio-group v-model="loginType" type="radio" class="switch-group">
                  <a-radio value="phone">手机号</a-radio>
                  <a-radio value="email">邮箱</a-radio>
                </a-radio-group>
              </a-form-item>

              <template v-if="loginType === 'phone'">
                <a-form-item class="compact-item" label="手机号" required>
                  <div class="phone-line">
                    <a-select
                      v-model="loginForm.countryCode"
                      :options="countryCodeOptions"
                      size="large"
                      class="country-code-select"
                      style="width: 120px; margin-right: 8px"
                    />
                    <a-input
                      v-model="loginForm.phone"
                      placeholder="请输入手机号"
                      allow-clear
                      size="large"
                      class="phone-input"
                    />
                  </div>
                </a-form-item>

                <a-form-item class="compact-item" label="登录方式">
                  <a-radio-group v-model="phoneLoginMode" type="radio" class="switch-group">
                    <a-radio value="password">密码登录</a-radio>
                    <a-radio value="captcha">短信验证</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-form-item
                  v-if="phoneLoginMode === 'password'"
                  class="compact-item"
                  label="密码"
                  required
                >
                  <a-input-password
                    v-model="loginForm.password"
                    placeholder="请输入密码"
                    allow-clear
                    size="large"
                  >
                    <template #prefix>
                      <icon-lock />
                    </template>
                  </a-input-password>
                </a-form-item>

                <a-form-item v-else class="compact-item" label="短信验证码" required>
                  <a-input
                    v-model="loginForm.captcha"
                    placeholder="请输入验证码"
                    allow-clear
                    size="large"
                  >
                    <template #prefix>
                      <icon-email />
                    </template>
                    <template #append>
                      <a-button
                        type="text"
                        :disabled="smsCountdown > 0"
                        class="captcha-btn"
                        @click="handleSendCaptcha"
                      >
                        {{ smsCountdown > 0 ? `${smsCountdown}s后重试` : '发送验证码' }}
                      </a-button>
                    </template>
                  </a-input>
                </a-form-item>
              </template>

              <template v-else>
                <a-form-item class="compact-item" label="163 邮箱" required>
                  <a-input
                    v-model="loginForm.emailPrefix"
                    placeholder="请输入邮箱前缀"
                    allow-clear
                    size="large"
                  >
                    <template #prefix>
                      <icon-email />
                    </template>
                    <template #append>@163.com</template>
                  </a-input>
                </a-form-item>

                <a-form-item class="compact-item" label="密码" required>
                  <a-input-password
                    v-model="loginForm.password"
                    placeholder="请输入密码"
                    allow-clear
                    size="large"
                  >
                    <template #prefix>
                      <icon-lock />
                    </template>
                  </a-input-password>
                </a-form-item>
              </template>

              <a-form-item class="submit-item">
                <a-button
                  type="primary"
                  long
                  size="large"
                  :loading="loginLoading"
                  @click="handlePasswordLogin"
                >
                  {{
                    loginType === 'phone' && phoneLoginMode === 'captcha' ? '验证码登录' : '登录'
                  }}
                </a-button>
              </a-form-item>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- 设置抽屉 -->
    <SettingDrawer v-model:visible="showSettingsDrawer" />
  </a-layout-header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/searchStore'
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { Message } from '@arco-design/web-vue'
import SettingDrawer from '@/components/content/setting/setting.vue'
import { ROUTE_NAMES } from '@/router/routeNames'
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconSettings,
  IconUser,
  IconMinus,
  IconFullscreen,
  IconClose,
  IconExport,
  IconCheckCircleFill,
  IconQrcode,
  IconEmail,
  IconLock
} from '@arco-design/web-vue/es/icon'
import appIcon from '@/assets/icon/icon.png'

const router = useRouter()

const searchStore = useSearchStore()
const { setSearchKeyword, setHasSearched } = searchStore

const userStore = useUserStore()
const { userInfo, isLoggedIn, loginLoading, qrCodeImg, qrCodeStatus } = storeToRefs(userStore)

const userVipTag = computed(() => {
  const info = userInfo.value
  if (!info) return ''

  const vipType = Number(info.vipType ?? -1)

  const isBlackVip = vipType === 110 || Number(info.redVipLevel ?? 0) > 0
  return isBlackVip ? '黑胶VIP' : ''
})

const userVipClass = computed(() => {
  if (userVipTag.value === 'SVIP') return 'vip-tag--svip'
  if (userVipTag.value === '黑胶VIP') return 'vip-tag--black'
  return ''
})

const searchKeyword = ref('')
const isDarkMode = ref(document.body.getAttribute('arco-theme') === 'dark')

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
  loginForm.value = {
    countryCode: '86',
    phone: '',
    emailPrefix: '',
    password: '',
    captcha: ''
  }
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
    Message.warning('请输入搜索关键词')
    return
  }

  console.log('Searching for:', searchKeyword.value)

  // 设置搜索关键词到 store，触发搜索页面的监听
  setSearchKeyword(searchKeyword.value.trim())

  // 切换到搜索页面
  router.push({ name: ROUTE_NAMES.SONG_SEARCH })
}

const handleClearSearch = () => {
  searchKeyword.value = ''
  setSearchKeyword('')
  setHasSearched(false)
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

// 刷新二维码
const refreshQrCode = async () => {
  qrCodeLoading.value = true
  stopQrCodePolling()

  try {
    await userStore.generateQrCode()
    if (qrCodeImg.value) {
      startQrCodePolling()
    }
  } catch (error) {
    console.error('获取二维码失败:', error)
  } finally {
    qrCodeLoading.value = false
  }
}

// 开始轮询二维码状态
const startQrCodePolling = () => {
  stopQrCodePolling()
  qrCodeTimer = setInterval(async () => {
    const result = await userStore.checkQrCodeStatus()
    if (result) {
      if (result.status === 'success') {
        stopQrCodePolling()
        showLoginModal.value = false
        Message.success('登录成功')
      } else if (result.status === 'expired') {
        stopQrCodePolling()
      }
    }
  }, 2000)
}

// 停止轮询
const stopQrCodePolling = () => {
  if (qrCodeTimer) {
    clearInterval(qrCodeTimer)
    qrCodeTimer = null
  }
}

const handleSendCaptcha = async () => {
  if (!isPhoneValid(loginForm.value.phone)) {
    Message.warning('请输入正确的手机号')
    return
  }

  const result = await userStore.sendCaptcha(loginForm.value.phone, loginForm.value.countryCode)
  if (result.success) {
    Message.success('验证码已发送')
    startSmsCountdown()
  } else {
    Message.error(result.message || '验证码发送失败')
  }
}

// 密码登录
const handlePasswordLogin = async () => {
  if (loginType.value === 'phone') {
    if (!isPhoneValid(loginForm.value.phone)) {
      Message.warning('请输入正确的手机号')
      return
    }
  } else {
    if (!loginForm.value.emailPrefix) {
      Message.warning('请输入163邮箱前缀')
      return
    }
  }

  let result
  if (loginType.value === 'phone') {
    if (phoneLoginMode.value === 'password') {
      if (!loginForm.value.password) {
        Message.warning('请输入密码')
        return
      }
      result = await userStore.loginByPhone(
        loginForm.value.phone,
        loginForm.value.password,
        loginForm.value.countryCode
      )
    } else {
      if (!loginForm.value.captcha) {
        Message.warning('请输入短信验证码')
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
      Message.warning('请输入密码')
      return
    }
    result = await userStore.loginByEmail(build163Email(), loginForm.value.password)
  }

  if (result.success) {
    showLoginModal.value = false
    Message.success('登录成功')
    // 重置表单
    resetLoginForm()
    stopSmsCountdown()
  } else {
    Message.error(result.message || '登录失败')
  }
}

// 退出登录
const handleLogout = async () => {
  const success = await userStore.logout()
  if (success) {
    Message.success('已退出登录')
  }
}

// 关闭登录弹窗
const handleCloseLoginModal = () => {
  stopQrCodePolling()
  stopSmsCountdown()
  userStore.resetQrCode()
  resetLoginForm()
}

const handleuserinfo = () => {
  showSettingsDrawer.value = true
}

onMounted(() => {
  // 恢复主题
  const savedTheme = localStorage.getItem('arco-theme')
  if (savedTheme) {
    document.body.setAttribute('arco-theme', savedTheme)
    isDarkMode.value = savedTheme === 'dark'
  }

  // 恢复用户信息
  userStore.restoreUserInfo()
})

onUnmounted(() => {
  stopQrCodePolling()
  stopSmsCountdown()
})
</script>

<style scoped lang="scss">
@import './navbar.scss';

.header-right .a-button.active {
  color: rgb(var(--primary-6));
}
</style>
