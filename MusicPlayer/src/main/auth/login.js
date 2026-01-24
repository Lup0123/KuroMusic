// 登录认证相关 API
import {
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_cellphone,
  login_status,
  logout as logoutApi,
  user_account,
  captcha_sent
} from '@neteasecloudmusicapienhanced/api'
import Store from 'electron-store'

// 兼容处理 ESM/CommonJS 导入
const StoreConstructor = Store.default || Store

// 创建持久化存储
const store = new StoreConstructor({
  name: 'music-player-auth',
  defaults: {
    cookie: ''
  }
})

// 存储 cookie - 从持久化存储中恢复
let userCookie = store.get('cookie') || ''
if (userCookie) {
  console.log('从本地存储恢复cookie，长度:', userCookie.length)
}

const auth = {
  // ============ 二维码登录 ============

  // 生成二维码 key
  async generateQRkey() {
    try {
      const response = await login_qr_key({ timestamp: Date.now() })
      return response.body
    } catch (error) {
      console.error('生成二维码 key 失败:', error)
      throw error
    }
  },

  // 生成二维码图片
  async generateQRcode(key) {
    try {
      const response = await login_qr_create({
        key,
        qrimg: true,
        timestamp: Date.now()
      })
      return response.body
    } catch (error) {
      console.error('生成二维码失败:', error)
      throw error
    }
  },

  // 检查二维码扫描状态
  // 返回码: 800-过期 801-等待扫码 802-已扫码待确认 803-登录成功
  async checkQRstatus(key) {
    try {
      const response = await login_qr_check({
        key,
        timestamp: Date.now()
      })
      // 登录成功时保存 cookie
      if (response.body.code === 803 && response.body.cookie) {
        userCookie = response.body.cookie
        store.set('cookie', userCookie)
        console.log('二维码登录成功，cookie已保存并持久化，长度:', userCookie.length)
      }
      return response.body
    } catch (error) {
      console.error('检查二维码状态失败:', error)
      throw error
    }
  },

  // ============ 手机号登录 ============

  // 手机号密码登录
  async loginByPhone(phone, password) {
    try {
      const response = await login_cellphone({
        phone,
        password,
        timestamp: Date.now()
      })
      // 登录成功时保存 cookie
      if (response.body.code === 200 && response.body.cookie) {
        userCookie = response.body.cookie
        store.set('cookie', userCookie)
        console.log('手机号登录成功，cookie已保存并持久化，长度:', userCookie.length)
      }
      return response.body
    } catch (error) {
      console.error('手机号登录失败:', error)
      throw error
    }
  },

  // 手机号验证码登录
  async loginByPhoneCaptcha(phone, captcha) {
    try {
      const response = await login_cellphone({
        phone,
        captcha,
        timestamp: Date.now()
      })
      // 登录成功时保存 cookie
      if (response.body.code === 200 && response.body.cookie) {
        userCookie = response.body.cookie
        store.set('cookie', userCookie)
      }
      return response.body
    } catch (error) {
      console.error('验证码登录失败:', error)
      throw error
    }
  },

  // 发送验证码
  async sendCaptcha(phone) {
    try {
      const response = await captcha_sent({
        phone,
        timestamp: Date.now()
      })
      return response.body
    } catch (error) {
      console.error('发送验证码失败:', error)
      throw error
    }
  },

  // ============ 邮箱登录 ============

  // 邮箱密码登录（网易云已不支持邮箱登录，保留接口但返回提示）
  async loginByEmail(email, password) {
    return {
      code: 501,
      message: '网易云音乐已不支持邮箱登录，请使用手机号或二维码登录'
    }
  },

  // ============ 用户信息 ============

  // 获取登录状态
  async getLoginStatus() {
    try {
      const response = await login_status({
        cookie: userCookie,
        timestamp: Date.now()
      })
      return response.body
    } catch (error) {
      console.error('获取登录状态失败:', error)
      throw error
    }
  },

  // 获取用户账号信息
  async getUserAccount() {
    try {
      console.log(
        'getUserAccount - 当前cookie:',
        userCookie ? `存在(长度${userCookie.length})` : '不存在'
      )
      const response = await user_account({
        cookie: userCookie,
        timestamp: Date.now()
      })
      return response.body
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
  },

  // ============ 退出登录 ============

  // 退出登录
  async logout() {
    try {
      const response = await logoutApi({
        cookie: userCookie,
        timestamp: Date.now()
      })
      // 清除 cookie
      userCookie = ''
      store.set('cookie', '')
      console.log('已退出登录，cookie已清除')
      return response.body
    } catch (error) {
      console.error('退出登录失败:', error)
      throw error
    }
  },

  // 获取当前 cookie
  getCookie() {
    return userCookie
  },

  // 设置 cookie（用于恢复登录状态）
  setCookie(cookie) {
    userCookie = cookie
    store.set('cookie', cookie)
    console.log('cookie已设置并持久化，长度:', cookie ? cookie.length : 0)
  }
}

export { auth }

// 导出 getCookie 函数供其他模块使用
export const getCookie = () => {
  // console.log('getCookie被调用，当前cookie:', userCookie ? `存在(长度${userCookie.length})` : '不存在')
  return userCookie
}
