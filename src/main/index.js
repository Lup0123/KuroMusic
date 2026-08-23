import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import https from 'https'
import http from 'http'
import icon from '../../resources/icon.png?asset'
import * as musicMetadata from 'music-metadata'
import { playlistConfig } from './getLocalConfig/playlistconfig'
import { aiConfig } from './getLocalConfig/aiConfig'
import { auth, getCookie } from './auth/login'
import { recommendPlaylistByLLM } from './ai/llmPlaylist'
import { runLangChainRecommend, rerankCandidates } from './ai/langchainRecommend'
import { ragService } from './ai/ragService'
import { embed as embedTexts, prewarm as prewarmEmbedding } from './ai/embeddingService'
import { findNearestTags, prewarm as prewarmLexicon } from './ai/tagLexicon'
import { behaviorConfig } from './getLocalConfig/behaviorConfig'
import {
  recordEvent as recordBehaviorEvent,
  disableAndClear as disableBehaviorTracking
} from './ai/behaviorTracker'
import {
  cloudsearch,
  song_url_v1,
  song_download_url_v1,
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
  personalized,
  personal_fm,
  top_song,
  fm_trash,
  artist_top_song,
  artist_album
} from '@neteasecloudmusicapienhanced/api'

let mainWindow = null
let aiWindow = null
let normalWindowBounds = null
const MINI_WINDOW_SIZE = { width: 380, height: 88 }
const gotLock = app.requestSingleInstanceLock()

function createAiWindow() {
  if (aiWindow && !aiWindow.isDestroyed()) {
    if (aiWindow.isMinimized()) aiWindow.restore()
    aiWindow.show()
    aiWindow.focus()
    return aiWindow
  }

  aiWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1180,
    minHeight: 576,
    show: false,
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    autoHideMenuBar: true,
    title: 'AI 歌单助手',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  aiWindow.on('ready-to-show', () => {
    aiWindow?.show()
    aiWindow?.focus()
  })

  aiWindow.on('maximize', () => {
    if (aiWindow && !aiWindow.isDestroyed()) {
      aiWindow.webContents.send('ai-window-maximized-changed', true)
    }
  })

  aiWindow.on('unmaximize', () => {
    if (aiWindow && !aiWindow.isDestroyed()) {
      aiWindow.webContents.send('ai-window-maximized-changed', false)
    }
  })

  aiWindow.on('closed', () => {
    aiWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    aiWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    aiWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return aiWindow
}

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

  mainWindow.on('close', (event) => {
    if (closeToTray && !isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      tipCloseToTray()
    }
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

let tray = null
let closeToTray = false
let closeToTrayTipped = false
let isQuitting = false
let autoCheckUpdate = true
let updateChecking = false
let updateDownloaded = false

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function tipCloseToTray() {
  if (closeToTrayTipped) return
  closeToTrayTipped = true
  if (process.platform === 'win32' && tray) {
    try {
      tray.displayBalloon({
        title: 'Kuromusic 已最小化到托盘',
        content: '点击托盘图标即可恢复窗口'
      })
    } catch {
      // 忽略气泡提示失败
    }
  }
}

function sendPlayerCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('player-command', command)
  }
}

function createTray() {
  if (tray) return tray

  tray = new Tray(icon)
  tray.setToolTip('Kuromusic')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMainWindow },
      { type: 'separator' },
      { label: '播放 / 暂停', click: () => sendPlayerCommand('toggle-play') },
      { label: '上一首', click: () => sendPlayerCommand('previous') },
      { label: '下一首', click: () => sendPlayerCommand('next') },
      { type: 'separator' },
      { label: '迷你模式', click: () => sendPlayerCommand('toggle-mini') },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
  )
  tray.on('click', showMainWindow)
  return tray
}
function registerGlobalShortcuts(payload) {
  globalShortcut.unregisterAll()
  if (!payload?.enabled) return { disabled: true }

  const results = {}
  const shortcuts = payload.shortcuts || {}
  for (const [command, accelerator] of Object.entries(shortcuts)) {
    const acc = typeof accelerator === 'string' ? accelerator.trim() : ''
    if (!acc) {
      results[command] = { ok: false, reason: 'empty' }
      continue
    }
    try {
      const ok = globalShortcut.register(acc, () => sendPlayerCommand(command))
      results[command] = ok ? { ok: true } : { ok: false, reason: 'conflict' }
    } catch {
      results[command] = { ok: false, reason: 'invalid' }
    }
  }
  return results
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function initAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update-status', { status: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    updateChecking = false
    sendToRenderer('update-status', { status: 'available', version: info?.version || '' })
  })
  autoUpdater.on('update-not-available', (info) => {
    updateChecking = false
    sendToRenderer('update-status', { status: 'not-available', version: info?.version || '' })
  })
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: Math.round(progress?.percent || 0),
      transferred: progress?.transferred || 0,
      total: progress?.total || 0
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    updateChecking = false
    updateDownloaded = true
    sendToRenderer('update-status', { status: 'downloaded', version: info?.version || '' })
  })
  autoUpdater.on('error', (error) => {
    updateChecking = false
    sendToRenderer('update-status', { status: 'error', message: error?.message || String(error) })
  })
}

async function checkForUpdates(silent = false) {
  if (updateChecking) return { ok: false, reason: 'checking' }
  updateChecking = true
  try {
    const result = await autoUpdater.checkForUpdates()
    return { ok: true, updateInfo: result?.updateInfo || null }
  } catch (error) {
    updateChecking = false
    if (!silent) {
      sendToRenderer('update-status', { status: 'error', message: error?.message || String(error) })
    }
    return { ok: false, reason: 'error', message: error?.message || String(error) }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('Kuromusic')

    // Prewarm local embedding model during idle, so first AI use is fast.
    setTimeout(() => {
      prewarmEmbedding()
        .then(() => prewarmLexicon(embedTexts))
        .catch((error) => {
          console.error('[AI][embedding] prewarm failed:', error?.message || error)
        })
    }, 5000)

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

    ipcMain.handle('search', async (event, keyword, typeid, limit = 30, offset = 0) => {
      try {
        const response = await cloudsearch({
          keywords: keyword,
          type: typeid,
          limit,
          offset,
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

    ipcMain.handle('ai-recommend-playlist', async (event, prompt, context = {}) => {
      try {
        const localProviderConfig = aiConfig.getProviderConfig()
        const apiKey =
          String(context?.apiKey || '').trim() ||
          localProviderConfig.apiKey ||
          process.env.ALIBABA_API_KEY ||
          ''
        if (!apiKey) {
          return {
            success: false,
            error: '未配置 AI Provider Key（可在设置中填写）'
          }
        }

        const model =
          String(context?.model || '').trim() ||
          localProviderConfig.model ||
          process.env.ALIBABA_MODEL ||
          'qwen-plus'
        const baseUrl =
          String(context?.baseUrl || '').trim() ||
          localProviderConfig.baseUrl ||
          process.env.ALIBABA_BASE_URL ||
          'https://dashscope.aliyuncs.com/compatible-mode/v1'

        const llmClient = async ({ prompt: userPrompt, messages = [] }) => {
          // Diagnostic logging for provider configuration (masked key)
          const maskedKey = apiKey ? `${apiKey.slice(0, 4)}***${apiKey.slice(-2)}` : ''
          console.log('[AI] provider config', {
            model,
            baseUrl,
            hasApiKey: Boolean(apiKey),
            apiKeyHint: maskedKey
          })
          console.log('[AI] llm request payload', {
            prompt: String(userPrompt || ''),
            messageCount: Array.isArray(messages) ? messages.length : 0,
            messages: Array.isArray(messages)
              ? messages.map((item) => ({
                  role: item?.role === 'assistant' ? 'assistant' : 'user',
                  content: String(item?.content || '')
                }))
              : []
          })

          const structured = await runLangChainRecommend({
            prompt: userPrompt,
            messages,
            apiKey,
            model,
            baseUrl,
            timeoutMs: Number(context?.timeoutMs) || 35000
          })
          return JSON.stringify(structured)
        }

        const ragResult = ragService.buildContext(prompt, {
          limit: 5,
          sourceTypes: ['lyrics', 'playlist', 'preference']
        })
        const mergedMessages = [
          ...(ragResult.context
            ? [
                {
                  role: 'system',
                  content: `本地 RAG 上下文：\n${ragResult.context}`
                }
              ]
            : []),
          ...(Array.isArray(context?.messages) ? context.messages : [])
        ]

        const searchSongs = async (keyword, limit = 30, offset = 0) => {
          const response = await cloudsearch({
            keywords: keyword,
            type: 1,
            limit,
            offset,
            cookie: getCookie()
          })

          const songs = response?.body?.result?.songs || []
          return songs.map((item) => ({
            id: item.id,
            name: item.name,
            artists: item.ar,
            artist:
              item.ar
                ?.map((artist) => artist?.name)
                .filter(Boolean)
                .join(' / ') || '未知艺术家',
            album: item.al?.name || '未知专辑',
            albumCover: item.al?.picUrl || '',
            durationMs: item.dt,
            duration: item.dt
          }))
        }

        const semanticExpander = async ({ prompt: userPrompt, intent, artist, include }) => {
          try {
            const query = [userPrompt, intent, artist, ...(include || [])]
              .filter(Boolean)
              .join(' ')
            const vectors = await embedTexts([query])
            if (!vectors || !vectors[0]) return []
            const tags = await findNearestTags(vectors[0], 3, embedTexts)
            return tags.map((tag) => tag.label)
          } catch {
            return []
          }
        }

        const result = await recommendPlaylistByLLM({
          prompt,
          context: {
            ...context,
            messages: mergedMessages,
            ragContext: ragResult.hits
          },
          searchSongs,
          llmClient,
          semanticExpander
        })

        return {
          success: true,
          ...result
        }
      } catch (error) {
        console.error('AI 推荐歌单失败:', error)
        return {
          success: false,
          error: error?.message || 'AI 推荐失败'
        }
      }
    })

    ipcMain.handle('ai-rerank-candidates', async (event, payload = {}) => {
      try {
        const provider = aiConfig.getProviderConfig()
        const apiKey = String(payload?.apiKey || provider.apiKey || '')
        const model =
          String(payload?.model || provider.model || '').trim() ||
          process.env.ALIBABA_MODEL ||
          'qwen-plus'
        const baseUrl =
          String(payload?.baseUrl || '').trim() ||
          provider.baseUrl ||
          process.env.ALIBABA_BASE_URL ||
          'https://dashscope.aliyuncs.com/compatible-mode/v1'
        const songs = Array.isArray(payload?.songs) ? payload.songs : []

        if (!apiKey) {
          return { success: false, error: '未配置 AI API Key，请在设置中填写' }
        }
        if (songs.length < 2) {
          return { success: false, error: '候选歌曲不足，无法精排' }
        }

        const result = await rerankCandidates({
          songs,
          apiKey,
          model,
          baseUrl,
          timeoutMs: Number(payload?.timeoutMs) || 20000
        })
        return { success: true, ...result }
      } catch (error) {
        console.error('AI 精排失败:', error?.message || error)
        return {
          success: false,
          error: error?.message || 'AI 精排失败'
        }
      }
    })

    ipcMain.handle('behavior-get-config', () => behaviorConfig.getConfig())

    ipcMain.handle('behavior-set-enabled', (event, enabled) => {
      behaviorConfig.setEnabled(Boolean(enabled))
      if (!enabled) disableBehaviorTracking()
      return behaviorConfig.getConfig()
    })

    ipcMain.handle('behavior-mark-prompt-shown', () => behaviorConfig.markPromptShown())

    ipcMain.handle('behavior-record-event', (event, payload = {}) => {
      return recordBehaviorEvent(payload)
    })

    ipcMain.handle('ai-chat-stream', async (event, payload = {}) => {
      const requestId = String(payload?.requestId || `req-${Date.now()}`)

      try {
        const localProviderConfig = aiConfig.getProviderConfig()
        const apiKey =
          String(payload?.apiKey || '').trim() ||
          localProviderConfig.apiKey ||
          process.env.ALIBABA_API_KEY ||
          ''
        if (!apiKey) {
          return {
            success: false,
            requestId,
            error: '未配置 AI Provider Key（可在设置中填写）'
          }
        }

        const model =
          String(payload?.model || '').trim() ||
          localProviderConfig.model ||
          process.env.ALIBABA_MODEL ||
          'qwen-plus'
        const baseUrl =
          String(payload?.baseUrl || '').trim() ||
          localProviderConfig.baseUrl ||
          process.env.ALIBABA_BASE_URL ||
          'https://dashscope.aliyuncs.com/compatible-mode/v1'
        const timeoutMs = Number(payload?.timeoutMs) || 35000
        const endpoint = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`

        const history = Array.isArray(payload?.messages)
          ? payload.messages
              .slice(-8)
              .filter((item) => item && typeof item.content === 'string')
              .map((item) => ({
                role: item.role === 'assistant' ? 'assistant' : 'user',
                content: String(item.content || '')
              }))
          : []

        const prompt = String(payload?.prompt || '').trim()
        const resumeFrom = String(payload?.resumeFrom || '').trim()
        const systemContent =
          '你是音乐助手。当前任务是与用户进行讨论，不要直接生成歌单结果对象，给出简洁、有帮助的自然语言回复。'
        const resumedSystemContent = resumeFrom
          ? `${systemContent}\n\n注意：这是一次网络中断后的续传。你上一段回复末尾是："${resumeFrom}"。请避免从头重复，直接自然衔接后续内容。`
          : systemContent
        const messages = [
          {
            role: 'system',
            content: resumedSystemContent
          },
          ...history,
          {
            role: 'user',
            content: prompt
          }
        ]

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              stream: true,
              temperature: 0.3,
              max_tokens: 600
            }),
            signal: controller.signal
          })

          if (!response.ok) {
            const detail = await response.text()
            event.sender.send('ai-chat-stream-error', {
              requestId,
              code: 'http',
              message: `LLM HTTP ${response.status}: ${String(detail || '').slice(0, 240)}`
            })
            return {
              success: false,
              requestId,
              errorCode: 'http',
              error: `LLM HTTP ${response.status}`
            }
          }

          if (!response.body) {
            event.sender.send('ai-chat-stream-error', {
              requestId,
              code: 'empty',
              message: 'LLM 流式响应为空'
            })
            return {
              success: false,
              requestId,
              errorCode: 'empty',
              error: 'LLM stream body empty'
            }
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder('utf-8')
          let done = false
          let buffer = ''

          while (!done) {
            const chunk = await reader.read()
            done = chunk.done
            buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !done })

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data:')) continue

              const payloadLine = trimmed.slice(5).trim()
              if (!payloadLine || payloadLine === '[DONE]') continue

              try {
                const parsed = JSON.parse(payloadLine)
                const token = parsed?.choices?.[0]?.delta?.content || ''
                if (!token) continue
                event.sender.send('ai-chat-stream-chunk', {
                  requestId,
                  token
                })
              } catch {
                // ignore malformed chunk line
              }
            }
          }

          event.sender.send('ai-chat-stream-end', {
            requestId,
            finishReason: 'stop'
          })

          return { success: true, requestId }
        } finally {
          clearTimeout(timer)
        }
      } catch (error) {
        const isTimeout = error?.name === 'AbortError'
        const errorCode = isTimeout ? 'timeout' : 'network'
        const message = isTimeout
          ? `LLM request timed out after ${Number(payload?.timeoutMs) || 35000}ms`
          : error?.message || 'AI 对话失败'
        event.sender.send('ai-chat-stream-error', {
          requestId,
          code: errorCode,
          message
        })
        return {
          success: false,
          requestId,
          errorCode,
          error: message
        }
      }
    })

    ipcMain.handle('open-ai-window', async () => {
      createAiWindow()
      return { success: true }
    })

    ipcMain.handle('focus-ai-window', async () => {
      if (!aiWindow || aiWindow.isDestroyed()) {
        return { success: false, reason: 'ai_window_not_found' }
      }
      if (aiWindow.isMinimized()) aiWindow.restore()
      aiWindow.show()
      aiWindow.focus()
      return { success: true }
    })

    ipcMain.handle('close-ai-window', async () => {
      if (!aiWindow || aiWindow.isDestroyed()) {
        return { success: true }
      }
      aiWindow.close()
      return { success: true }
    })

    ipcMain.handle('get-window-role', async (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      if (!senderWindow) return 'main'
      if (aiWindow && !aiWindow.isDestroyed() && senderWindow.id === aiWindow.id) return 'ai'
      return 'main'
    })

    ipcMain.handle('get-ai-provider-config', async () => {
      try {
        return { success: true, data: aiConfig.getProviderConfig() }
      } catch (error) {
        return { success: false, error: error?.message || '读取 AI 配置失败' }
      }
    })

    ipcMain.handle('set-ai-provider-config', async (event, payload = {}) => {
      try {
        const data = aiConfig.setProviderConfig(payload)
        return { success: true, data }
      } catch (error) {
        return { success: false, error: error?.message || '保存 AI 配置失败' }
      }
    })

    ipcMain.handle('rag-search', async (event, payload = {}) => {
      try {
        const data = ragService.buildContext(String(payload?.query || ''), {
          limit: Number(payload?.limit) || 5,
          sourceTypes: Array.isArray(payload?.sourceTypes) ? payload.sourceTypes : []
        })
        return { success: true, data }
      } catch (error) {
        return { success: false, error: error?.message || 'RAG 检索失败' }
      }
    })

    ipcMain.handle('rag-index-preference', async (event, payload = {}) => {
      try {
        const data = ragService.indexPreference(payload?.id || Date.now(), payload)
        return { success: true, data }
      } catch (error) {
        return { success: false, error: error?.message || 'RAG 偏好入库失败' }
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
        try {
          ragService.indexLyrics(songId, response?.body || response, {
            title: response?.body?.lrc?.lyric ? `歌词 ${songId}` : `歌曲 ${songId}`
          })
        } catch (error) {
          console.error('[RAG] 索引歌词失败:', error)
        }
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

    ipcMain.handle('get-top-playlists', async (event, cat, limit = 60) => {
      try {
        const response = await top_playlist_highquality({ cat, limit, cookie: getCookie() })
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
        try {
          ragService.indexPlaylist(playlistId, response?.body?.playlist || response?.body || response)
        } catch (error) {
          console.error('[RAG] 索引歌单失败:', error)
        }
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
        try {
          ragService.indexPlaylist(playlistId, response?.body?.songs || response?.body || response)
        } catch (error) {
          console.error('[RAG] 索引歌单歌曲失败:', error)
        }
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

    // 获取私人FM（需要登录）
    ipcMain.handle('get-personal-fm', async () => {
      try {
        const cookie = getCookie()
        if (!cookie) {
          console.log('未登录，返回空私人FM')
          return { body: { data: [] } }
        }

        const response = await personal_fm({
          cookie: cookie,
          timestamp: Date.now()
        })
        return response
      } catch (error) {
        console.error('获取私人FM失败:', error)
        return { body: { data: [] } }
      }
    })

    // 获取新歌速递
    // type: 0-全部, 7-华语, 96-欧美, 8-日本, 16-韩国
    ipcMain.handle('get-top-songs', async (event, type = 0) => {
      try {
        const response = await top_song({
          type,
          cookie: getCookie(),
          timestamp: Date.now()
        })
        return response
      } catch (error) {
        console.error('获取新歌速递失败:', error)
        return { body: { data: [] } }
      }
    })

    // 将歌曲添加到FM垃圾桶（不再推荐）
    ipcMain.handle('fm-trash', async (event, songId) => {
      try {
        const cookie = getCookie()
        if (!cookie) {
          return { code: 301, message: '未登录' }
        }

        const response = await fm_trash({
          id: songId,
          cookie: cookie,
          timestamp: Date.now()
        })
        return response.body
      } catch (error) {
        console.error('FM垃圾桶操作失败:', error)
        return { code: 500, message: error.message }
      }
    })

    // 获取歌手热门单曲
    ipcMain.handle('get-artist-top-songs', async (event, artistId) => {
      try {
        const response = await artist_top_song({
          id: artistId,
          cookie: getCookie(),
          timestamp: Date.now()
        })
        return response
      } catch (error) {
        console.error('获取歌手热门单曲失败:', error)
        return { body: { songs: [] } }
      }
    })

    // 获取歌手专辑
    ipcMain.handle('get-artist-albums', async (event, artistId, limit = 20, offset = 0) => {
      try {
        const response = await artist_album({
          id: artistId,
          limit,
          offset,
          cookie: getCookie(),
          timestamp: Date.now()
        })
        return response
      } catch (error) {
        console.error('获取歌手专辑失败:', error)
        return { body: { hotAlbums: [] } }
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
    ipcMain.handle('login-by-phone', async (event, phone, password, countryCode = '86') => {
      try {
        return await auth.loginByPhone(phone, password, countryCode)
      } catch (error) {
        console.error('手机号登录失败:', error)
        return { code: 500, message: error.message }
      }
    })

    // 手机号验证码登录
    ipcMain.handle('login-by-phone-captcha', async (event, phone, captcha, countryCode = '86') => {
      try {
        return await auth.loginByPhoneCaptcha(phone, captcha, countryCode)
      } catch (error) {
        console.error('验证码登录失败:', error)
        return { code: 500, message: error.message }
      }
    })

    // 发送验证码
    ipcMain.handle('send-captcha', async (event, phone, countryCode = '86') => {
      try {
        return await auth.sendCaptcha(phone, countryCode)
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

    // ============ 下载功能 ============
    // 选择下载目录
    ipcMain.handle('select-download-directory', async () => {
      try {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory'],
          title: '选择下载目录'
        })
        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, path: result.filePaths[0] }
        }
        return { success: false }
      } catch (error) {
        console.error('选择目录失败:', error)
        return { success: false, error: error.message }
      }
    })

    // 获取歌曲下载 URL（使用 song_download_url_v1）
    ipcMain.handle('get-song-download-url', async (event, songId, level) => {
      try {
        const response = await song_download_url_v1({
          id: songId,
          level: level, // standard, higher, exhigh, lossless, hires, jyeffect, sky, jymaster
          cookie: getCookie()
        })
        return response
      } catch (error) {
        console.error('获取下载URL失败:', error)
        return { success: false, error: error.message }
      }
    })

    // 下载歌曲文件
    ipcMain.handle('download-song', async (event, { url, savePath, fileName }) => {
      return new Promise((resolve, reject) => {
        try {
          const protocol = url.startsWith('https') ? https : http
          const fullPath = join(savePath, fileName)

          protocol
            .get(url, (response) => {
              if (response.statusCode === 302 || response.statusCode === 301) {
                // 处理重定向
                const redirectUrl = response.headers.location
                const redirectProtocol = redirectUrl.startsWith('https') ? https : http

                redirectProtocol.get(redirectUrl, (redirectResponse) => {
                  const chunks = []
                  redirectResponse.on('data', (chunk) => chunks.push(chunk))
                  redirectResponse.on('end', () => {
                    try {
                      const buffer = Buffer.concat(chunks)
                      writeFileSync(fullPath, buffer)
                      resolve({ success: true, path: fullPath })
                    } catch (err) {
                      reject({ success: false, error: err.message })
                    }
                  })
                  redirectResponse.on('error', (err) => {
                    reject({ success: false, error: err.message })
                  })
                })
              } else {
                const chunks = []
                response.on('data', (chunk) => chunks.push(chunk))
                response.on('end', () => {
                  try {
                    const buffer = Buffer.concat(chunks)
                    writeFileSync(fullPath, buffer)
                    resolve({ success: true, path: fullPath })
                  } catch (err) {
                    reject({ success: false, error: err.message })
                  }
                })
                response.on('error', (err) => {
                  reject({ success: false, error: err.message })
                })
              }
            })
            .on('error', (err) => {
              reject({ success: false, error: err.message })
            })
        } catch (error) {
          reject({ success: false, error: error.message })
        }
      })
    })

    // 保存已下载歌曲信息
    ipcMain.handle('save-downloaded-song', async (event, songInfo) => {
      try {
        const userDataPath = app.getPath('userData')
        const downloadedSongsFile = join(userDataPath, 'downloaded-songs.json')

        let downloadedSongs = []
        if (existsSync(downloadedSongsFile)) {
          const data = readFileSync(downloadedSongsFile, 'utf-8')
          downloadedSongs = JSON.parse(data)
        }

        // 检查是否已存在
        const existingIndex = downloadedSongs.findIndex((s) => s.id === songInfo.id)
        if (existingIndex >= 0) {
          downloadedSongs[existingIndex] = songInfo
        } else {
          downloadedSongs.push(songInfo)
        }

        writeFileSync(downloadedSongsFile, JSON.stringify(downloadedSongs, null, 2))
        return { success: true }
      } catch (error) {
        console.error('保存下载记录失败:', error)
        return { success: false, error: error.message }
      }
    })

    // 获取已下载歌曲列表
    ipcMain.handle('get-downloaded-songs', async () => {
      try {
        const userDataPath = app.getPath('userData')
        const downloadedSongsFile = join(userDataPath, 'downloaded-songs.json')

        if (existsSync(downloadedSongsFile)) {
          const data = readFileSync(downloadedSongsFile, 'utf-8')
          return { success: true, songs: JSON.parse(data) }
        }
        return { success: true, songs: [] }
      } catch (error) {
        console.error('获取下载列表失败:', error)
        return { success: false, error: error.message, songs: [] }
      }
    })

    // 删除已下载歌曲记录
    ipcMain.handle('remove-downloaded-song', async (event, songId) => {
      try {
        const userDataPath = app.getPath('userData')
        const downloadedSongsFile = join(userDataPath, 'downloaded-songs.json')

        if (existsSync(downloadedSongsFile)) {
          const data = readFileSync(downloadedSongsFile, 'utf-8')
          let downloadedSongs = JSON.parse(data)
          downloadedSongs = downloadedSongs.filter((s) => s.id !== songId)
          writeFileSync(downloadedSongsFile, JSON.stringify(downloadedSongs, null, 2))
        }
        return { success: true }
      } catch (error) {
        console.error('删除下载记录失败:', error)
        return { success: false, error: error.message }
      }
    })

    // 删除本地文件
    ipcMain.handle('delete-file', async (event, filePath) => {
      try {
        if (!filePath) {
          return { success: false, error: '文件路径为空' }
        }
        if (existsSync(filePath)) {
          unlinkSync(filePath)
        }
        return { success: true }
      } catch (error) {
        console.error('删除文件失败:', error)
        return { success: false, error: error.message }
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
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (closeToTray) {
        mainWindow.hide()
        tipCloseToTray()
      } else {
        mainWindow.close()
      }
    })

    ipcMain.on('set-close-to-tray', (event, enabled) => {
      closeToTray = Boolean(enabled)
    })

    ipcMain.handle('set-auto-launch', (event, enabled) => {
      if (process.platform !== 'win32' && process.platform !== 'darwin') {
        return { ok: false, reason: 'unsupported-platform' }
      }
      const openAtLogin = Boolean(enabled)
      const options = app.isPackaged
        ? { openAtLogin }
        : { openAtLogin, path: process.execPath, args: [app.getAppPath()] }
      app.setLoginItemSettings(options)
      return { ok: true, enabled: openAtLogin }
    })

    ipcMain.handle('get-auto-launch', () => {
      if (process.platform !== 'win32' && process.platform !== 'darwin') {
        return { ok: false, reason: 'unsupported-platform' }
      }
      return { ok: true, enabled: app.getLoginItemSettings().openAtLogin }
    })

    ipcMain.handle('check-for-updates', (event, silent) => {
      return checkForUpdates(Boolean(silent))
    })

    ipcMain.handle('quit-and-install-update', () => {
      if (updateDownloaded) {
        autoUpdater.quitAndInstall()
        return { ok: true }
      }
      return { ok: false }
    })

    ipcMain.on('set-auto-check-update', (event, enabled) => {
      autoCheckUpdate = Boolean(enabled)
    })

    ipcMain.on('show-main-window', showMainWindow)

    ipcMain.handle('global-shortcuts-register', (event, payload) => {
      return registerGlobalShortcuts(payload)
    })

    ipcMain.handle('set-mini-mode', async (event, isMini) => {
      if (!mainWindow || mainWindow.isDestroyed()) return { ok: false }

      if (isMini) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize()
        normalWindowBounds = mainWindow.getBounds()
        mainWindow.setResizable(true)
        mainWindow.setMinimumSize(0, 0)
        mainWindow.setSize(MINI_WINDOW_SIZE.width, MINI_WINDOW_SIZE.height)
        if (process.platform === 'darwin') {
          mainWindow.setAlwaysOnTop(true, 'floating')
        } else {
          mainWindow.setAlwaysOnTop(true)
        }
        mainWindow.setSkipTaskbar(true)
        mainWindow.setResizable(false)
        mainWindow.center()
      } else {
        mainWindow.setAlwaysOnTop(false)
        mainWindow.setSkipTaskbar(false)
        mainWindow.setResizable(true)
        mainWindow.setMinimumSize(1280, 720)
        if (normalWindowBounds) {
          mainWindow.setBounds(normalWindowBounds)
          normalWindowBounds = null
        }
      }

      return { ok: true, isMini: Boolean(isMini) }
    })

    createWindow()
    createTray()
    initAutoUpdater()
    setTimeout(() => {
      if (app.isPackaged && autoCheckUpdate) checkForUpdates(true)
    }, 60 * 1000)

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  ipcMain.handle('get-ai-window-maximized', async () => {
    if (!aiWindow || aiWindow.isDestroyed()) return false
    return aiWindow.isMaximized()
  })

  ipcMain.on('ai-window-minimize', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const targetWindow =
      senderWindow && aiWindow && !aiWindow.isDestroyed() && senderWindow.id === aiWindow.id
        ? senderWindow
        : aiWindow
    if (!targetWindow || targetWindow.isDestroyed()) return
    targetWindow.minimize()
  })

  ipcMain.on('ai-window-maximize', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const targetWindow =
      senderWindow && aiWindow && !aiWindow.isDestroyed() && senderWindow.id === aiWindow.id
        ? senderWindow
        : aiWindow
    if (!targetWindow || targetWindow.isDestroyed()) return
    if (targetWindow.isMaximized()) targetWindow.restore()
    else targetWindow.maximize()
  })

  ipcMain.on('ai-window-close', () => {
    if (!aiWindow || aiWindow.isDestroyed()) return
    aiWindow.close()
  })
}

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
app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
