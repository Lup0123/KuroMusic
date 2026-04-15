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

function normalizeStoredSong(song) {
  if (!song || typeof song !== 'object') return song
  const cover = song.cover || song.albumCover || song.al?.picUrl || ''
  return {
    ...song,
    cover
  }
}

function normalizeStoredPlaylist(playlist) {
  if (!playlist || typeof playlist !== 'object') return playlist
  const songs = Array.isArray(playlist.songs) ? playlist.songs.map(normalizeStoredSong) : []
  const firstSongCover = songs[0]?.cover || songs[0]?.albumCover || songs[0]?.al?.picUrl || ''
  const cover = playlist.cover || firstSongCover || ''
  return {
    ...playlist,
    songs,
    cover
  }
}

// 歌单相关操作
const playlistConfig = {
  // 获取所有歌单
  getAllPlaylists() {
    return {
      created: this.getCreatedPlaylists(),
      favorite: this.getFavoritePlaylists()
    }
  },

  // 获取创建的歌单
  getCreatedPlaylists() {
    const raw = store.get('playlists.created', [])
    const normalized = Array.isArray(raw) ? raw.map(normalizeStoredPlaylist) : []
    const changed = JSON.stringify(raw) !== JSON.stringify(normalized)
    if (changed) {
      store.set('playlists.created', normalized)
    }
    return normalized
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
      cover: '', // 封面由第一首歌决定
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
        const normalizedSong = {
          ...song,
          cover: song?.cover || song?.albumCover || song?.al?.picUrl || ''
        }
        playlists[index].songs.push(normalizedSong)
        playlists[index].updateTime = new Date().toISOString()
        // 如果是第一首歌，更新封面
        if (playlists[index].songs.length === 1 && normalizedSong.cover) {
          playlists[index].cover = normalizedSong.cover
        }
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
      const removedSongIndex = playlists[index].songs.findIndex((s) => s.id === songId)
      playlists[index].songs = playlists[index].songs.filter((s) => s.id !== songId)
      playlists[index].updateTime = new Date().toISOString()
      // 如果删除的是第一首歌，更新封面为新的第一首歌
      if (removedSongIndex === 0) {
        playlists[index].cover =
          playlists[index].songs[0]?.cover ||
          playlists[index].songs[0]?.albumCover ||
          playlists[index].songs[0]?.al?.picUrl ||
          ''
      }
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
