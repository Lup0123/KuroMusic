import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 用户信息
  const userInfo = ref(null)
  const isLoggedIn = computed(() => !!userInfo.value)

  // 登录状态
  const loginLoading = ref(false)

  // 二维码相关
  const qrCodeKey = ref('')
  const qrCodeImg = ref('')
  const qrCodeStatus = ref('waiting') // waiting, scanned, confirmed, expired

  // 设置用户信息
  const setUserInfo = (info) => {
    userInfo.value = info
    // 持久化存储
    if (info) {
      localStorage.setItem('userInfo', JSON.stringify(info))
    } else {
      localStorage.removeItem('userInfo')
    }
  }

  // 从本地存储恢复用户信息
  const restoreUserInfo = () => {
    const stored = localStorage.getItem('userInfo')
    if (stored) {
      try {
        userInfo.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem('userInfo')
      }
    }
  }

  // 从服务器刷新用户资料；失败或未返回资料时保留本地信息，不自动登出
  const refreshUserInfo = async () => {
    if (!userInfo.value) return
    try {
      const response = await window.api.getUserAccount()
      if (response?.profile) setUserInfo(response.profile)
    } catch (error) {
      console.error('刷新用户信息失败:', error)
    }
  }

  // 退出登录
  const logout = async () => {
    try {
      await window.api.logout()
      setUserInfo(null)
      return true
    } catch (error) {
      console.error('退出登录失败:', error)
      return false
    }
  }

  // 手机号密码登录
  const loginByPhone = async (phone, password, countryCode = '86') => {
    loginLoading.value = true
    try {
      const response = await window.api.loginByPhone(phone, password, countryCode)
      console.log('手机号登录响应:', response)
      if (response.code === 200) {
        console.log('登录成功，用户信息:', response.profile)
        setUserInfo(response.profile)
        return { success: true }
      }
      return { success: false, message: response.message || '登录失败' }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, message: error.message }
    } finally {
      loginLoading.value = false
    }
  }

  // 手机号验证码登录
  const loginByPhoneCaptcha = async (phone, captcha, countryCode = '86') => {
    loginLoading.value = true
    try {
      const response = await window.api.loginByPhoneCaptcha(phone, captcha, countryCode)
      if (response.code === 200) {
        setUserInfo(response.profile)
        return { success: true }
      }
      return { success: false, message: response.message || '登录失败' }
    } catch (error) {
      console.error('验证码登录失败:', error)
      return { success: false, message: error.message }
    } finally {
      loginLoading.value = false
    }
  }

  // 发送短信验证码
  const sendCaptcha = async (phone, countryCode = '86') => {
    try {
      const response = await window.api.sendCaptcha(phone, countryCode)
      if (response.code === 200) {
        return { success: true }
      }
      return { success: false, message: response.message || '验证码发送失败' }
    } catch (error) {
      console.error('发送验证码失败:', error)
      return { success: false, message: error.message }
    }
  }

  // 邮箱密码登录
  const loginByEmail = async (email, password) => {
    loginLoading.value = true
    try {
      const response = await window.api.loginByEmail(email, password)
      if (response.code === 200) {
        setUserInfo(response.profile)
        return { success: true }
      }
      return { success: false, message: response.message || '登录失败' }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, message: error.message }
    } finally {
      loginLoading.value = false
    }
  }

  // 获取二维码key
  const getQrCodeKey = async () => {
    try {
      const response = await window.api.getQRkey()
      if (response.code === 200) {
        qrCodeKey.value = response.data.unikey
        return qrCodeKey.value
      }
      return null
    } catch (error) {
      console.error('获取二维码key失败:', error)
      return null
    }
  }

  // 生成二维码
  const generateQrCode = async () => {
    try {
      const key = await getQrCodeKey()
      if (!key) return null

      const response = await window.api.getQRcode(key)
      if (response.code === 200) {
        qrCodeImg.value = response.data.qrimg
        qrCodeStatus.value = 'waiting'
        return qrCodeImg.value
      }
      return null
    } catch (error) {
      console.error('生成二维码失败:', error)
      return null
    }
  }

  // 检查二维码状态
  const checkQrCodeStatus = async () => {
    if (!qrCodeKey.value) return null

    try {
      const response = await window.api.checkQRstatus(qrCodeKey.value)
      // 800: 二维码过期 801: 等待扫码 802: 已扫码待确认 803: 登录成功
      if (response.code === 803) {
        qrCodeStatus.value = 'confirmed'
        // 获取用户信息
        const userResponse = await window.api.getUserAccount()
        console.log('二维码登录成功，用户信息:', userResponse)
        if (userResponse.profile) {
          console.log('保存用户信息:', userResponse.profile)
          setUserInfo(userResponse.profile)
        }
        return { status: 'success' }
      } else if (response.code === 802) {
        qrCodeStatus.value = 'scanned'
        return { status: 'scanned' }
      } else if (response.code === 800) {
        qrCodeStatus.value = 'expired'
        return { status: 'expired' }
      }
      return { status: 'waiting' }
    } catch (error) {
      console.error('检查二维码状态失败:', error)
      return null
    }
  }

  // 重置二维码状态
  const resetQrCode = () => {
    qrCodeKey.value = ''
    qrCodeImg.value = ''
    qrCodeStatus.value = 'waiting'
  }

  return {
    userInfo,
    isLoggedIn,
    loginLoading,
    qrCodeKey,
    qrCodeImg,
    qrCodeStatus,
    setUserInfo,
    restoreUserInfo,
    refreshUserInfo,
    logout,
    loginByPhone,
    loginByPhoneCaptcha,
    sendCaptcha,
    loginByEmail,
    getQrCodeKey,
    generateQrCode,
    checkQrCodeStatus,
    resetQrCode
  }
})
