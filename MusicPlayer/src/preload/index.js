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
  search: (keyword) => ipcRenderer.invoke('search', keyword),
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
  getPlaylistById: (playlistId) => ipcRenderer.invoke('get-playlist-by-id', playlistId)
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
