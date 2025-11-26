import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as musicMetadata from 'music-metadata'
import {
  cloudsearch,
  song_url_v1,
  lyric_new,
  playlist_hot,
  top_playlist_highquality,
  playlist_detail,
  playlist_track_all
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

  ipcMain.handle('search', async (event, keyword) => {
    try {
      const response = await cloudsearch({
        keywords: keyword,
        limit: 50,
        type: 1
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
        level: quality // standard, higher, exhigh, lossless, hires
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
        id: songId
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
      const response = await playlist_hot() // 假设你有一个函数可以获取热门歌单
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
      const response = await top_playlist_highquality({ cat }) // 假设你有一个函数可以获取分类歌单
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
      const response = await playlist_detail({ id: playlistId }) // 假设你有一个函数可以获取歌单详情
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
      const response = await playlist_track_all({ id: playlistId }) // 假设你有一个函数可以获取歌单所有歌曲
      return response
    } catch (error) {
      console.error('获取歌单所有歌曲时发生错误：', error)
      return {
        success: false,
        error: error.message
      }
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
