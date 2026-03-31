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

  selectMusicFiles: () => ipcRenderer.invoke('select-music-files'),
  getMusicMetadata: (filePath) => ipcRenderer.invoke('get-music-metadata', filePath),
  search: (keyword, typeid, limit, offset) =>
    ipcRenderer.invoke('search', keyword, typeid, limit, offset),
  getSongUrl: (songId, quality) => ipcRenderer.invoke('get-song-url', songId, quality),
  getSongLyrics: (songId) => ipcRenderer.invoke('get-song-lyrics', songId),
  getHotPlaylists: () => ipcRenderer.invoke('get-hot-playlists'),
  getTopPlaylists: (cat) => ipcRenderer.invoke('get-top-playlists', cat),
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

  // ============ 个性化推荐 API ============
  getRecommendResource: () => ipcRenderer.invoke('get-recommend-resource'),
  getRecommendSongs: () => ipcRenderer.invoke('get-recommend-songs'),
  getPersonalizedPlaylists: (limit) => ipcRenderer.invoke('get-personalized-playlists', limit),
  getPersonalFM: () => ipcRenderer.invoke('get-personal-fm'),
  getTopSongs: (type) => ipcRenderer.invoke('get-top-songs', type),
  fmTrash: (songId) => ipcRenderer.invoke('fm-trash', songId),

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
