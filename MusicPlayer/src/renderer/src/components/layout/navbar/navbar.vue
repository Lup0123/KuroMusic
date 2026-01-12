<template>
  <a-layout-header class="header draggable-area">
    <div class="header-left">
      <img class="app-logo" width="50" height="50" :src="appIcon" alt="logo" />
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

      <!-- 用户按钮 -->
      <a-dropdown trigger="click" v-if="isLoggedIn" class="no-drag">
        <a-avatar :size="32" class="user-avatar" style="cursor: pointer">
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
                <div class="level">Lv.{{ userInfo?.level || 0 }}</div>
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
      </div>
    </div>

    <!-- 登录弹窗 -->
    <a-modal
      v-model:visible="showLoginModal"
      :footer="false"
      :width="400"
      title="登录"
      @close="handleCloseLoginModal"
    >
      <a-tabs v-model:active-key="loginTab" class="login-tabs">
        <!-- 二维码登录 -->
        <a-tab-pane key="qrcode" title="二维码登录">
          <div class="qrcode-login">
            <div class="qrcode-container">
              <div v-if="qrCodeImg" class="qrcode-wrapper">
                <img :src="qrCodeImg" alt="二维码" class="qrcode-img" />
                <div v-if="qrCodeStatus === 'scanned'" class="qrcode-mask scanned">
                  <icon-check-circle-fill :size="48" />
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
                  <icon-qrcode :size="64" style="color: var(--color-text-4)" />
                  <p>点击获取登录二维码</p>
                  <a-button type="primary" @click="refreshQrCode">获取二维码</a-button>
                </div>
              </div>
            </div>
            <p class="qrcode-tip">使用网易云音乐APP扫码登录</p>
          </div>
        </a-tab-pane>

        <!-- 密码登录 -->
        <a-tab-pane key="password" title="密码登录">
          <a-form :model="loginForm" layout="vertical" class="login-form">
            <a-form-item label="登录方式">
              <a-radio-group v-model="loginType" type="button">
                <a-radio value="phone">手机号</a-radio>
                <a-radio value="email">邮箱</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item v-if="loginType === 'phone'" label="手机号" required>
              <a-input
                v-model="loginForm.phone"
                placeholder="请输入手机号"
                allow-clear
                size="large"
              >
                <template #prefix>
                  <icon-phone />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item v-else label="邮箱" required>
              <a-input v-model="loginForm.email" placeholder="请输入邮箱" allow-clear size="large">
                <template #prefix>
                  <icon-email />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item label="密码" required>
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

            <a-form-item>
              <a-button
                type="primary"
                long
                size="large"
                :loading="loginLoading"
                @click="handlePasswordLogin"
              >
                登录
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </a-layout-header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSearchStore } from '@/stores/searchStore'
import { useUserStore } from '@/stores/userStore'
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
  IconClose,
  IconExport,
  IconCheckCircleFill,
  IconQrcode,
  IconPhone,
  IconEmail,
  IconLock
} from '@arco-design/web-vue/es/icon'
import appIcon from '@/assets/icon/icon.png'

const songStore = useSongStore()
const { showPlaylist, currentSong } = storeToRefs(songStore)

const indexStore = useIndexStore()
const { setCurIndex } = indexStore

const searchStore = useSearchStore()
const { setSearchKeyword, setHasSearched, setLoading } = searchStore

const userStore = useUserStore()
const { userInfo, isLoggedIn, loginLoading, qrCodeImg, qrCodeStatus } = storeToRefs(userStore)

const searchKeyword = ref('')
const isDarkMode = ref(document.body.getAttribute('arco-theme') === 'dark')

// 登录相关状态
const showLoginModal = ref(false)
const loginTab = ref('qrcode')
const loginType = ref('phone')
const qrCodeLoading = ref(false)
const loginForm = ref({
  phone: '',
  email: '',
  password: ''
})

// 二维码轮询定时器
let qrCodeTimer = null

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
    Message.error('获取二维码失败')
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

// 密码登录
const handlePasswordLogin = async () => {
  if (loginType.value === 'phone') {
    if (!loginForm.value.phone) {
      Message.warning('请输入手机号')
      return
    }
  } else {
    if (!loginForm.value.email) {
      Message.warning('请输入邮箱')
      return
    }
  }

  if (!loginForm.value.password) {
    Message.warning('请输入密码')
    return
  }

  let result
  if (loginType.value === 'phone') {
    result = await userStore.loginByPhone(loginForm.value.phone, loginForm.value.password)
  } else {
    result = await userStore.loginByEmail(loginForm.value.email, loginForm.value.password)
  }

  if (result.success) {
    showLoginModal.value = false
    Message.success('登录成功')
    // 重置表单
    loginForm.value = { phone: '', email: '', password: '' }
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
  userStore.resetQrCode()
  loginForm.value = { phone: '', email: '', password: '' }
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
})
</script>

<style scoped lang="scss">
@import './navbar.scss';

.header-right .a-button.active {
  color: rgb(var(--primary-6));
}
</style>
