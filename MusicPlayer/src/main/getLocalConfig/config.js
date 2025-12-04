import Store from 'electron-store'

// 兼容处理 ESM/CommonJS 导入
const StoreConstructor = Store.default || Store

// 创建 store 实例
const store = new StoreConstructor({
  name: 'music-player-config',
  defaults: {
    playlists: {
      created: [], // 我创建的歌单
      favorite: [] // 收藏的歌单
    },
    settings: {
      theme: 'light',
      volume: 70
    }
  }
})

// 歌单相关操作
const playlistConfig = {
  // 获取所有歌单
  getAllPlaylists() {
    return store.get('playlists', { created: [], favorite: [] })
  },

  // 获取创建的歌单
  getCreatedPlaylists() {
    return store.get('playlists.created', [])
  },

  // 获取收藏的歌单
  getFavoritePlaylists() {
    return store.get('playlists.favorite', [])
  },

  // 创建新歌单
  createPlaylist(playlist) {
    const playlists = this.getCreatedPlaylists()
    const newPlaylist = {
      id: Date.now(),
      name: playlist.name,
      description: playlist.description || '',
      cover: playlist.cover || '',
      songs: [],
      isLocal: true, // 标识为本地歌单
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    }
    playlists.push(newPlaylist)
    store.set('playlists.created', playlists)
    return newPlaylist
  },

  // 更新歌单信息
  updatePlaylist(playlistId, updates) {
    const playlists = this.getCreatedPlaylists()
    const index = playlists.findIndex((p) => p.id === playlistId)
    if (index > -1) {
      playlists[index] = {
        ...playlists[index],
        ...updates,
        updateTime: new Date().toISOString()
      }
      store.set('playlists.created', playlists)
      return playlists[index]
    }
    return null
  },

  // 删除歌单
  deletePlaylist(playlistId) {
    const playlists = this.getCreatedPlaylists()
    const filtered = playlists.filter((p) => p.id !== playlistId)
    store.set('playlists.created', filtered)
    return true
  },

  // 添加歌曲到歌单
  addSongToPlaylist(playlistId, song) {
    const playlists = this.getCreatedPlaylists()
    const index = playlists.findIndex((p) => p.id === playlistId)
    if (index > -1) {
      if (!playlists[index].songs) {
        playlists[index].songs = []
      }
      // 检查歌曲是否已存在
      const songExists = playlists[index].songs.some((s) => s.id === song.id)
      if (!songExists) {
        playlists[index].songs.push(song)
        playlists[index].updateTime = new Date().toISOString()
        store.set('playlists.created', playlists)
        return true
      }
      return false
    }
    return false
  },

  // 从歌单移除歌曲
  removeSongFromPlaylist(playlistId, songId) {
    const playlists = this.getCreatedPlaylists()
    const index = playlists.findIndex((p) => p.id === playlistId)
    if (index > -1) {
      playlists[index].songs = playlists[index].songs.filter((s) => s.id !== songId)
      playlists[index].updateTime = new Date().toISOString()
      store.set('playlists.created', playlists)
      return true
    }
    return false
  },

  // 收藏歌单
  addFavoritePlaylist(playlist) {
    const favorites = this.getFavoritePlaylists()
    const exists = favorites.some((p) => p.id === playlist.id)
    if (!exists) {
      favorites.push({
        ...playlist,
        favoriteTime: new Date().toISOString()
      })
      store.set('playlists.favorite', favorites)
      return true
    }
    return false
  },

  // 取消收藏歌单
  removeFavoritePlaylist(playlistId) {
    const favorites = this.getFavoritePlaylists()
    const filtered = favorites.filter((p) => p.id !== playlistId)
    store.set('playlists.favorite', filtered)
    return true
  },

  // 获取歌单详情
  getPlaylistById(playlistId) {
    const created = this.getCreatedPlaylists()
    const favorites = this.getFavoritePlaylists()
    return created.find((p) => p.id === playlistId) || favorites.find((p) => p.id === playlistId)
  }
}

export { playlistConfig, store }
