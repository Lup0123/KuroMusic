import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as musicMetadata from 'music-metadata'
import { playlistConfig } from './getLocalConfig/playlistconfig'
import { auth, getCookie } from './auth/login'
import {
  cloudsearch,
  song_url_v1,
  lyric_new,
  playlist_hot,
  top_playlist_highquality,
  playlist_detail,
  playlist_track_all,
  user_playlist,
  like,
  likelist,
  recommend_resource,
  recommend_songs,
  personalized
} from '@neteasecloudmusicapienhanced/api'

let mainWindow = null

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    minWidth: 1280,
    minHeight: 720,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // 添加这行,允许跨域加载资源
    }
  })

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.music.126.net/*', 'http://*.music.126.net/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://music.163.com/'
      details.requestHeaders['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  // 允许跨域
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*']
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.handle('select-music-files', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: '音频文件',
            extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma']
          },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      return result
    } catch (error) {
      console.error('选择文件失败:', error)
      return { canceled: true, filePaths: [] }
    }
  })

  ipcMain.handle('get-music-metadata', async (event, filePath) => {
    try {
      const metadata = await musicMetadata.parseFile(filePath)

      console.log('读取到的原始元数据:', {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        duration: metadata.format.duration
      })

      // 处理封面图片
      let pictureData = ''
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0]
        pictureData = `data:${picture.format};base64,${picture.data.toString('base64')}`
      }

      // 标准化艺术家字段（可能是字符串或数组）
      let artist = metadata.common.artist || ''
      if (Array.isArray(artist)) {
        artist = artist.join(', ')
      }

      // 标准化专辑字段（可能是字符串或数组）
      let album = metadata.common.album || ''
      if (Array.isArray(album)) {
        album = album[0] || ''
      }

      return {
        title: metadata.common.title || '',
        artist: artist,
        album: album,
        duration: metadata.format.duration || 0,
        picture: pictureData
      }
    } catch (error) {
      console.error('读取元数据失败:', error)
      return {
        title: '',
        artist: '',
        album: '',
        duration: 0,
        picture: ''
      }
    }
  })

  ipcMain.handle('search', async (event, keyword, typeid) => {
    try {
      const response = await cloudsearch({
        keywords: keyword,
        type: typeid,
        cookie: getCookie()
      })

      return response
    } catch (error) {
      console.error('搜索时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 修复重复的 get-song-url,合并为一个
  ipcMain.handle('get-song-url', async (event, songId, quality = 'standard') => {
    try {
      const response = await song_url_v1({
        id: songId,
        level: quality, // standard, higher, exhigh, lossless, hires
        cookie: getCookie()
      })

      return response
    } catch (error) {
      console.error('获取歌曲URL时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('get-song-lyrics', async (event, songId) => {
    try {
      const response = await lyric_new({
        id: songId,
        cookie: getCookie()
      })
      return response
    } catch (error) {
      console.error('获取歌词时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('get-hot-playlists', async () => {
    try {
      const response = await playlist_hot({ cookie: getCookie() })
      return response
    } catch (error) {
      console.error('获取热门歌单时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('get-top-playlists', async (event, cat) => {
    try {
      const response = await top_playlist_highquality({ cat, cookie: getCookie() })
      return response
    } catch (error) {
      console.error('获取精选歌单时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('get-playlist-details', async (event, playlistId) => {
    try {
      const response = await playlist_detail({ id: playlistId, cookie: getCookie() })
      return response
    } catch (error) {
      console.error('获取歌单详情时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('get-playlist-all-songs', async (event, playlistId) => {
    try {
      const response = await playlist_track_all({ id: playlistId, cookie: getCookie() })
      return response
    } catch (error) {
      console.error('获取歌单所有歌曲时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // ========== 本地歌单管理 IPC 处理 ==========

  // 获取所有歌单
  ipcMain.handle('get-all-playlists', async () => {
    try {
      return playlistConfig.getAllPlaylists()
    } catch (error) {
      console.error('获取所有歌单失败:', error)
      return { created: [], favorite: [] }
    }
  })

  // 获取创建的歌单
  ipcMain.handle('get-created-playlists', async () => {
    try {
      return playlistConfig.getCreatedPlaylists()
    } catch (error) {
      console.error('获取创建的歌单失败:', error)
      return []
    }
  })

  // 获取收藏的歌单
  ipcMain.handle('get-favorite-playlists', async () => {
    try {
      return playlistConfig.getFavoritePlaylists()
    } catch (error) {
      console.error('获取收藏的歌单失败:', error)
      return []
    }
  })

  // 创建新歌单
  ipcMain.handle('create-playlist', async (event, playlist) => {
    try {
      return playlistConfig.createPlaylist(playlist)
    } catch (error) {
      console.error('创建歌单失败:', error)
      return null
    }
  })

  // 更新歌单信息
  ipcMain.handle('update-playlist', async (event, playlistId, updates) => {
    try {
      return playlistConfig.updatePlaylist(playlistId, updates)
    } catch (error) {
      console.error('更新歌单失败:', error)
      return null
    }
  })

  // 删除歌单
  ipcMain.handle('delete-playlist', async (event, playlistId) => {
    try {
      return playlistConfig.deletePlaylist(playlistId)
    } catch (error) {
      console.error('删除歌单失败:', error)
      return false
    }
  })

  // 添加歌曲到歌单
  ipcMain.handle('add-song-to-playlist', async (event, playlistId, song) => {
    try {
      return playlistConfig.addSongToPlaylist(playlistId, song)
    } catch (error) {
      console.error('添加歌曲到歌单失败:', error)
      return false
    }
  })

  // 从歌单移除歌曲
  ipcMain.handle('remove-song-from-playlist', async (event, playlistId, songId) => {
    try {
      return playlistConfig.removeSongFromPlaylist(playlistId, songId)
    } catch (error) {
      console.error('从歌单移除歌曲失败:', error)
      return false
    }
  })

  // 收藏歌单
  ipcMain.handle('add-favorite-playlist', async (event, playlist) => {
    try {
      return playlistConfig.addFavoritePlaylist(playlist)
    } catch (error) {
      console.error('收藏歌单失败:', error)
      return false
    }
  })

  // 取消收藏歌单
  ipcMain.handle('remove-favorite-playlist', async (event, playlistId) => {
    try {
      return playlistConfig.removeFavoritePlaylist(playlistId)
    } catch (error) {
      console.error('取消收藏歌单失败:', error)
      return false
    }
  })

  // 获取歌单详情
  ipcMain.handle('get-playlist-by-id', async (event, playlistId) => {
    try {
      return playlistConfig.getPlaylistById(playlistId)
    } catch (error) {
      console.error('获取歌单详情失败:', error)
      return null
    }
  })

  // 获取用户歌单
  ipcMain.handle('get-user-playlists', async (event, userId, limit) => {
    try {
      if (!userId) {
        console.error('用户ID为空')
        return []
      }

      const cookie = getCookie()
      const response = await user_playlist({
        uid: userId,
        limit: limit || 1000,
        cookie: cookie,
        timestamp: Date.now()
      })

      if (response.body && response.body.playlist) {
        // 返回用户的歌单列表
        return response.body.playlist.map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description || '',
          cover: playlist.coverImgUrl || '',
          playCount: playlist.playCount || 0,
          trackCount: playlist.trackCount || 0,
          creator: playlist.creator?.nickname || '',
          createTime: playlist.createTime,
          updateTime: playlist.updateTime,
          isLocal: false
        }))
      }

      return []
    } catch (error) {
      console.error('获取用户歌单失败:', error)
      return []
    }
  })

  // 喜欢/取消喜欢音乐
  ipcMain.handle('like-music', async (event, songId, isLike) => {
    try {
      const cookie = getCookie()
      if (!cookie) {
        console.error('未登录，无法操作')
        return { code: 301, message: '未登录' }
      }

      const response = await like({
        id: songId,
        like: isLike,
        cookie: cookie,
        timestamp: Date.now()
      })

      return response.body
    } catch (error) {
      console.error('喜欢音乐操作失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 获取喜欢的音乐列表
  ipcMain.handle('get-liked-songs', async (event, userId) => {
    try {
      const cookie = getCookie()
      console.log('获取喜欢列表 - Cookie:', cookie ? '存在' : '不存在', ', 用户ID:', userId)

      if (!cookie) {
        console.error('未登录：Cookie为空')
        return []
      }

      if (!userId) {
        console.error('用户ID为空')
        return []
      }

      const response = await likelist({
        uid: userId,
        cookie: cookie,
        timestamp: Date.now()
      })

      console.log('喜欢列表API响应:', response.body ? '成功' : '失败')

      if (response.body && response.body.ids) {
        console.log('获取到喜欢列表，共', response.body.ids.length, '首')
        return response.body.ids
      }

      return []
    } catch (error) {
      console.error('获取喜欢列表失败:', error)
      return []
    }
  })

  // ============ 个性化推荐 API ============
  // 获取每日推荐歌单（需要登录）
  ipcMain.handle('get-recommend-resource', async () => {
    try {
      const cookie = getCookie()
      if (!cookie) {
        console.log('未登录，返回空推荐歌单')
        return { body: { recommend: [] } }
      }

      const response = await recommend_resource({
        cookie: cookie,
        timestamp: Date.now()
      })
      return response
    } catch (error) {
      console.error('获取每日推荐歌单失败:', error)
      return { body: { recommend: [] } }
    }
  })

  // 获取每日推荐歌曲（需要登录）
  ipcMain.handle('get-recommend-songs', async () => {
    try {
      const cookie = getCookie()
      if (!cookie) {
        console.log('未登录，返回空推荐歌曲')
        return { body: { data: { dailySongs: [] } } }
      }

      const response = await recommend_songs({
        cookie: cookie,
        timestamp: Date.now()
      })
      return response
    } catch (error) {
      console.error('获取每日推荐歌曲失败:', error)
      return { body: { data: { dailySongs: [] } } }
    }
  })

  // 获取个性化推荐歌单（登录后更个性化）
  ipcMain.handle('get-personalized-playlists', async (event, limit = 30) => {
    try {
      const response = await personalized({
        limit,
        cookie: getCookie(),
        timestamp: Date.now()
      })
      return response
    } catch (error) {
      console.error('获取个性化推荐歌单失败:', error)
      return { body: { result: [] } }
    }
  })

  // ============ 登录相关 IPC 处理器 ============

  // 获取二维码 key
  ipcMain.handle('get-qr-key', async () => {
    try {
      return await auth.generateQRkey()
    } catch (error) {
      console.error('获取二维码 key 失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 生成二维码图片
  ipcMain.handle('get-qr-code', async (event, key) => {
    try {
      return await auth.generateQRcode(key)
    } catch (error) {
      console.error('生成二维码失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 检查二维码状态
  ipcMain.handle('check-qr-status', async (event, key) => {
    try {
      return await auth.checkQRstatus(key)
    } catch (error) {
      console.error('检查二维码状态失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 手机号密码登录
  ipcMain.handle('login-by-phone', async (event, phone, password) => {
    try {
      return await auth.loginByPhone(phone, password)
    } catch (error) {
      console.error('手机号登录失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 手机号验证码登录
  ipcMain.handle('login-by-phone-captcha', async (event, phone, captcha) => {
    try {
      return await auth.loginByPhoneCaptcha(phone, captcha)
    } catch (error) {
      console.error('验证码登录失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 发送验证码
  ipcMain.handle('send-captcha', async (event, phone) => {
    try {
      return await auth.sendCaptcha(phone)
    } catch (error) {
      console.error('发送验证码失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 邮箱密码登录
  ipcMain.handle('login-by-email', async (event, email, password) => {
    try {
      return await auth.loginByEmail(email, password)
    } catch (error) {
      console.error('邮箱登录失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 获取登录状态
  ipcMain.handle('get-login-status', async () => {
    try {
      return await auth.getLoginStatus()
    } catch (error) {
      console.error('获取登录状态失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 获取用户信息
  ipcMain.handle('get-user-account', async () => {
    try {
      return await auth.getUserAccount()
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return { code: 500, message: error.message }
    }
  })

  // 退出登录
  ipcMain.handle('logout', async () => {
    try {
      return await auth.logout()
    } catch (error) {
      console.error('退出登录失败:', error)
      return { code: 500, message: error.message }
    }
  })

  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
