import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setMiniMode: (isMini) => ipcRenderer.invoke('set-mini-mode', isMini),
  showWindow: () => ipcRenderer.send('show-main-window'),
  registerGlobalShortcuts: (payload) => ipcRenderer.invoke('global-shortcuts-register', payload),
  setCloseToTray: (enabled) => ipcRenderer.send('set-close-to-tray', enabled),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  checkForUpdates: (silent) => ipcRenderer.invoke('check-for-updates', silent),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  setAutoCheckUpdate: (enabled) => ipcRenderer.send('set-auto-check-update', enabled),
  onUpdateStatus: (callback) => {
    const listener = (_, payload) => callback?.(payload)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  onPlaylistsChanged: (callback) => {
    const listener = (_, payload) => callback?.(payload)
    ipcRenderer.on('playlists-changed', listener)
    return () => ipcRenderer.removeListener('playlists-changed', listener)
  },
  onPlayerCommand: (callback) => {
    const listener = (_, command) => callback?.(command)
    ipcRenderer.on('player-command', listener)
    return () => ipcRenderer.removeListener('player-command', listener)
  },
  // 界面缩放（主窗口与 AI 窗口共用档位）
  getUiZoom: () => ipcRenderer.invoke('get-ui-zoom'),
  setUiZoom: (factor) => ipcRenderer.invoke('set-ui-zoom', factor),
  onUiZoomChanged: (callback) => {
    const listener = (_, factor) => callback?.(factor)
    ipcRenderer.on('ui-zoom-changed', listener)
    return () => ipcRenderer.removeListener('ui-zoom-changed', listener)
  },

  selectMusicFiles: () => ipcRenderer.invoke('select-music-files'),
  getMusicMetadata: (filePath) => ipcRenderer.invoke('get-music-metadata', filePath),
  search: (keyword, typeid, limit, offset) =>
    ipcRenderer.invoke('search', keyword, typeid, limit, offset),
  getSongUrl: (songId, quality) => ipcRenderer.invoke('get-song-url', songId, quality),
  getSongLyrics: (songId) => ipcRenderer.invoke('get-song-lyrics', songId),
  getHotPlaylists: () => ipcRenderer.invoke('get-hot-playlists'),
  getTopPlaylists: (cat, limit) => ipcRenderer.invoke('get-top-playlists', cat, limit),
  getPlaylistsDetails: (playlistId) => ipcRenderer.invoke('get-playlist-details', playlistId),
  getPlaylistsAllSongs: (playlistId) => ipcRenderer.invoke('get-playlist-all-songs', playlistId),

  // 本地歌单管理
  getAllPlaylists: () => ipcRenderer.invoke('get-all-playlists'),
  getCreatedPlaylists: () => ipcRenderer.invoke('get-created-playlists'),
  getFavoritePlaylists: () => ipcRenderer.invoke('get-favorite-playlists'),
  createPlaylist: (playlist) => ipcRenderer.invoke('create-playlist', playlist),
  updatePlaylist: (playlistId, updates) =>
    ipcRenderer.invoke('update-playlist', playlistId, updates),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('delete-playlist', playlistId),
  addSongToPlaylist: (playlistId, song) =>
    ipcRenderer.invoke('add-song-to-playlist', playlistId, song),
  removeSongFromPlaylist: (playlistId, songId) =>
    ipcRenderer.invoke('remove-song-from-playlist', playlistId, songId),
  addFavoritePlaylist: (playlist) => ipcRenderer.invoke('add-favorite-playlist', playlist),
  removeFavoritePlaylist: (playlistId) =>
    ipcRenderer.invoke('remove-favorite-playlist', playlistId),
  getPlaylistById: (playlistId) => ipcRenderer.invoke('get-playlist-by-id', playlistId),
  getUserPlaylists: (userId, limit) => ipcRenderer.invoke('get-user-playlists', userId, limit),

  // ============ 喜欢音乐相关 API ============
  likeMusic: (songId, isLike) => ipcRenderer.invoke('like-music', songId, isLike),
  getLikedSongs: (userId) => ipcRenderer.invoke('get-liked-songs', userId),
  subscribePlaylist: (playlistId, subscribe) =>
    ipcRenderer.invoke('subscribe-playlist', playlistId, subscribe),
  onLikedSongChanged: (callback) => {
    const listener = (_, payload) => callback?.(payload)
    ipcRenderer.on('liked-song-changed', listener)
    return () => ipcRenderer.removeListener('liked-song-changed', listener)
  },

  // ============ 个性化推荐 API ============
  getRecommendResource: () => ipcRenderer.invoke('get-recommend-resource'),
  getRecommendSongs: () => ipcRenderer.invoke('get-recommend-songs'),
  getPersonalizedPlaylists: (limit) => ipcRenderer.invoke('get-personalized-playlists', limit),
  getTopSongs: (type) => ipcRenderer.invoke('get-top-songs', type),
  getArtistTopSongs: (artistId) => ipcRenderer.invoke('get-artist-top-songs', artistId),
  getArtistAlbums: (artistId, limit, offset) =>
    ipcRenderer.invoke('get-artist-albums', artistId, limit, offset),
  getArtistSongs: (artistId, order, offset, limit) =>
    ipcRenderer.invoke('get-artist-songs', artistId, order, offset, limit),
  getArtistDesc: (artistId) => ipcRenderer.invoke('get-artist-desc', artistId),
  getAlbumDetail: (albumId) => ipcRenderer.invoke('get-album-detail', albumId),
  aiRecommendPlaylist: (prompt, context) =>
    ipcRenderer.invoke('ai-recommend-playlist', prompt, context),
  aiRerankCandidates: (payload) => ipcRenderer.invoke('ai-rerank-candidates', payload),
  behaviorGetConfig: () => ipcRenderer.invoke('behavior-get-config'),
  behaviorSetEnabled: (enabled) => ipcRenderer.invoke('behavior-set-enabled', enabled),
  behaviorMarkPromptShown: () => ipcRenderer.invoke('behavior-mark-prompt-shown'),
  behaviorRecordEvent: (payload) => ipcRenderer.invoke('behavior-record-event', payload),
  aiChatStream: (payload) => ipcRenderer.invoke('ai-chat-stream', payload),
  openAiWindow: () => ipcRenderer.invoke('open-ai-window'),
  focusAiWindow: () => ipcRenderer.invoke('focus-ai-window'),
  closeAiWindow: () => ipcRenderer.invoke('close-ai-window'),
  getWindowRole: () => ipcRenderer.invoke('get-window-role'),
  ragSearch: (payload) => ipcRenderer.invoke('rag-search', payload),
  ragIndexPreference: (payload) => ipcRenderer.invoke('rag-index-preference', payload),
  aiWindowMinimize: () => ipcRenderer.send('ai-window-minimize'),
  aiWindowMaximize: () => ipcRenderer.send('ai-window-maximize'),
  aiWindowClose: () => ipcRenderer.send('ai-window-close'),
  getAiWindowMaximized: () => ipcRenderer.invoke('get-ai-window-maximized'),
  onAiWindowMaximizedChanged: (callback) => {
    const listener = (_, value) => callback(value)
    ipcRenderer.on('ai-window-maximized-changed', listener)
    return () => ipcRenderer.removeListener('ai-window-maximized-changed', listener)
  },
  onAiChatStreamChunk: (callback) => {
    const handler = (_, data) => callback?.(data)
    ipcRenderer.on('ai-chat-stream-chunk', handler)
    return () => ipcRenderer.removeListener('ai-chat-stream-chunk', handler)
  },
  onAiChatStreamEnd: (callback) => {
    const handler = (_, data) => callback?.(data)
    ipcRenderer.on('ai-chat-stream-end', handler)
    return () => ipcRenderer.removeListener('ai-chat-stream-end', handler)
  },
  onAiChatStreamError: (callback) => {
    const handler = (_, data) => callback?.(data)
    ipcRenderer.on('ai-chat-stream-error', handler)
    return () => ipcRenderer.removeListener('ai-chat-stream-error', handler)
  },
  getAiProviderConfig: () => ipcRenderer.invoke('get-ai-provider-config'),
  setAiProviderConfig: (payload) => ipcRenderer.invoke('set-ai-provider-config', payload),

  // ============ 登录相关 API ============
  // 二维码登录
  getQRkey: () => ipcRenderer.invoke('get-qr-key'),
  getQRcode: (key) => ipcRenderer.invoke('get-qr-code', key),
  checkQRstatus: (key) => ipcRenderer.invoke('check-qr-status', key),

  // 手机号登录
  loginByPhone: (phone, password, countryCode = '86') =>
    ipcRenderer.invoke('login-by-phone', phone, password, countryCode),
  loginByPhoneCaptcha: (phone, captcha, countryCode = '86') =>
    ipcRenderer.invoke('login-by-phone-captcha', phone, captcha, countryCode),
  sendCaptcha: (phone, countryCode = '86') =>
    ipcRenderer.invoke('send-captcha', phone, countryCode),

  // 邮箱登录
  loginByEmail: (email, password) => ipcRenderer.invoke('login-by-email', email, password),

  // 用户信息
  getLoginStatus: () => ipcRenderer.invoke('get-login-status'),
  getUserAccount: () => ipcRenderer.invoke('get-user-account'),
  logout: () => ipcRenderer.invoke('logout'),

  // ============ 下载相关 API ============
  selectDownloadDirectory: () => ipcRenderer.invoke('select-download-directory'),
  getSongDownloadUrl: (songId, level) => ipcRenderer.invoke('get-song-download-url', songId, level),
  downloadSong: (url, savePath, fileName) =>
    ipcRenderer.invoke('download-song', { url, savePath, fileName }),
  saveDownloadedSong: (songInfo) => ipcRenderer.invoke('save-downloaded-song', songInfo),
  getDownloadedSongs: () => ipcRenderer.invoke('get-downloaded-songs'),
  removeDownloadedSong: (songId) => ipcRenderer.invoke('remove-downloaded-song', songId),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ...electronAPI, ipcRenderer })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = { ...electronAPI, ipcRenderer }
  window.api = api
}
