import { defineStore } from 'pinia'
import { formatDuration } from '../utils/utils'
import { useSongStore } from './songStore'

export const usePlaylistStore = defineStore('playlist', {
  state: () => ({
    playlists: [],
    currentPlaylistInfo: {
      id: null,
      name: '',
      description: '',
      cover: '',
      playCount: 0,
      createTime: ''
    },
    currentPlaylistSongs: [], // 当前歌单的歌曲列表

    // 本地歌单管理
    createdPlaylists: [], // 我创建的歌单
    favoritePlaylists: [], // 收藏的歌单
    userPlaylists: [], // 用户的歌单
    likedSongIds: new Set(), // 喜欢的歌曲ID集合（使用Set优化查找性能）
    loading: false
  }),

  getters: {
    // 获取当前歌单歌曲数量
    currentPlaylistSongCount: (state) => state.currentPlaylistSongs.length,

    // 获取格式化的歌单信息
    formattedCurrentPlaylist: (state) => ({
      ...state.currentPlaylistInfo,
      songCount: state.currentPlaylistSongs.length
    }),

    // 获取所有本地歌单
    allLocalPlaylists: (state) => [...state.createdPlaylists, ...state.favoritePlaylists],

    // 通过 ID 获取歌单
    getPlaylistById: (state) => (id) => {
      return (
        state.createdPlaylists.find((p) => p.id === id) ||
        state.favoritePlaylists.find((p) => p.id === id)
      )
    }
  },

  actions: {
    // 设置当前歌单信息
    setCurrentPlaylist(playlist) {
      this.currentPlaylistInfo = playlist
    },

    // 设置当前歌单的歌曲列表
    setCurrentPlaylistSongs(songs) {
      this.currentPlaylistSongs = songs.map((song) => this.normalizeSong(song))
    },

    // 标准化歌曲数据格式
    normalizeSong(song) {
      return {
        id: song.id,
        name: song.name,
        alias: song.alia?.join(' / ') || song.alias || '',
        artist: song.ar?.map((a) => a.name).join(' / ') || song.artist || '未知艺术家',
        album: song.al?.name || song.album || '未知专辑',
        albumId: song.al?.id || song.albumId,
        cover: song.al?.picUrl || song.cover || 'https://via.placeholder.com/200',
        duration: song.duration || formatDuration(song.dt || song.durationMs),
        dt: song.dt || song.durationMs, // 保留毫秒用于播放器
        fee: song.fee || 0,
        mvId: song.mv || song.mvId,
        vip: song.fee === 1 || song.vip,
        liked: song.liked || this.likedSongIds.has(song.id), // 使用Set的has方法，O(1)查找
        // 音质信息
        quality: song.quality || {
          h: song.h,
          m: song.m,
          l: song.l,
          sq: song.sq,
          hr: song.hr
        }
      }
    },

    // 播放当前歌单的所有歌曲
    playCurrentPlaylist() {
      const songStore = useSongStore()
      if (this.currentPlaylistSongs.length > 0) {
        songStore.replacePlaylist(this.currentPlaylistSongs)
        songStore.playFromIndex(0)
        return true
      }
      return false
    },

    // 播放当前歌单的指定歌曲
    playCurrentPlaylistSong(index) {
      const songStore = useSongStore()
      if (index >= 0 && index < this.currentPlaylistSongs.length) {
        songStore.replacePlaylist(this.currentPlaylistSongs)
        songStore.playFromIndex(index)
        return true
      }
      return false
    },

    // ========== 本地歌单管理方法 ==========

    // 加载所有歌单
    async loadLocalPlaylists() {
      try {
        this.loading = true
        const data = await window.api.getAllPlaylists()
        this.createdPlaylists = data.created || []
        this.favoritePlaylists = data.favorite || []
      } catch (error) {
        console.error('加载歌单失败:', error)
      } finally {
        this.loading = false
      }
    },

    // 加载创建的歌单
    async loadCreatedPlaylists() {
      try {
        this.createdPlaylists = await window.api.getCreatedPlaylists()
      } catch (error) {
        console.error('加载创建的歌单失败:', error)
      }
    },

    // 加载收藏的歌单
    async loadFavoritePlaylists() {
      try {
        this.favoritePlaylists = await window.api.getFavoritePlaylists()
      } catch (error) {
        console.error('加载收藏的歌单失败:', error)
      }
    },

    // 加载用户歌单
    async loadUserPlaylists(userId) {
      try {
        if (!userId) {
          console.warn('playlistStore: 用户ID为空，无法加载用户歌单')
          this.userPlaylists = []
          return
        }
        this.loading = true
        const playlists = await window.api.getUserPlaylists(userId)
        this.userPlaylists = playlists || []

        // 异步加载喜欢的歌曲列表，不阻塞歌单显示
        this.loadLikedSongs(userId).catch((err) => {
          console.error('异步加载喜欢列表失败:', err)
        })
      } catch (error) {
        console.error('加载用户歌单失败:', error)
        this.userPlaylists = []
      } finally {
        this.loading = false
      }
    },

    // 加载喜欢的歌曲列表
    async loadLikedSongs(userId) {
      try {
        if (!userId) {
          console.warn('playlistStore: 用户ID为空，无法加载喜欢列表')
          this.likedSongIds = new Set()
          return
        }
        const startTime = performance.now()
        console.log('playlistStore: 开始加载喜欢列表，用户ID:', userId)

        const ids = await window.api.getLikedSongs(userId)
        // 将数组转换为Set以优化查找性能
        this.likedSongIds = new Set(ids || [])

        const loadTime = (performance.now() - startTime).toFixed(2)
        console.log(
          `playlistStore: 已加载喜欢的歌曲列表，共 ${this.likedSongIds.size} 首，耗时 ${loadTime}ms`
        )
      } catch (error) {
        console.error('加载喜欢列表失败:', error)
        this.likedSongIds = new Set()
      }
    },

    // 喜欢/取消喜欢音乐
    async toggleLikeSong(songId, isLike) {
      try {
        const response = await window.api.likeMusic(songId, isLike)
        if (response.code === 200) {
          if (isLike) {
            // 添加到喜欢列表
            this.likedSongIds.add(songId)
          } else {
            // 从喜欢列表移除
            this.likedSongIds.delete(songId)
          }
          return true
        }
        return false
      } catch (error) {
        console.error('喜欢操作失败:', error)
        return false
      }
    },

    // 检查歌曲是否被喜欢
    isSongLiked(songId) {
      return this.likedSongIds.has(songId)
    },

    // 创建新歌单
    async createLocalPlaylist(playlist) {
      try {
        const newPlaylist = await window.api.createPlaylist(playlist)
        if (newPlaylist) {
          // 确保本地歌单有 isLocal 标识
          newPlaylist.isLocal = true
          this.createdPlaylists.push(newPlaylist)
          return newPlaylist
        }
        return null
      } catch (error) {
        console.error('创建歌单失败:', error)
        return null
      }
    },

    // 更新歌单
    async updateLocalPlaylist(playlistId, updates) {
      try {
        const updated = await window.api.updatePlaylist(playlistId, updates)
        if (updated) {
          const index = this.createdPlaylists.findIndex((p) => p.id === playlistId)
          if (index > -1) {
            this.createdPlaylists[index] = updated
          }
          return updated
        }
        return null
      } catch (error) {
        console.error('更新歌单失败:', error)
        return null
      }
    },

    // 删除歌单
    async deleteLocalPlaylist(playlistId) {
      try {
        const success = await window.api.deletePlaylist(playlistId)
        if (success) {
          this.createdPlaylists = this.createdPlaylists.filter((p) => p.id !== playlistId)
          return true
        }
        return false
      } catch (error) {
        console.error('删除歌单失败:', error)
        return false
      }
    },

    // 添加歌曲到歌单
    async addSongToLocalPlaylist(playlistId, song) {
      try {
        const success = await window.api.addSongToPlaylist(playlistId, song)
        console.log(success)
        if (success) {
          const playlist = this.createdPlaylists.find((p) => p.id === playlistId)
          if (playlist) {
            if (!playlist.songs) {
              playlist.songs = []
            }
            playlist.songs.push(song)
          }
          return true
        }
        return false
      } catch (error) {
        console.error('添加歌曲到歌单失败:', error)
        return false
      }
    },

    // 从歌单移除歌曲
    async removeSongFromLocalPlaylist(playlistId, songId) {
      try {
        const success = await window.api.removeSongFromPlaylist(playlistId, songId)
        if (success) {
          const playlist = this.createdPlaylists.find((p) => p.id === playlistId)
          if (playlist && playlist.songs) {
            playlist.songs = playlist.songs.filter((s) => s.id !== songId)
          }
          return true
        }
        return false
      } catch (error) {
        console.error('从歌单移除歌曲失败:', error)
        return false
      }
    },

    // 收藏网易云歌单
    async addToFavoritePlaylist(playlist) {
      try {
        const success = await window.api.addFavoritePlaylist(playlist)
        if (success) {
          this.favoritePlaylists.push({
            ...playlist,
            favoriteTime: new Date().toISOString()
          })
          return true
        }
        return false
      } catch (error) {
        console.error('收藏歌单失败:', error)
        return false
      }
    },

    // 取消收藏歌单
    async removeFromFavoritePlaylist(playlistId) {
      try {
        const success = await window.api.removeFavoritePlaylist(playlistId)
        if (success) {
          this.favoritePlaylists = this.favoritePlaylists.filter((p) => p.id !== playlistId)
          return true
        }
        return false
      } catch (error) {
        console.error('取消收藏歌单失败:', error)
        return false
      }
    },

    // 添加歌单到收藏
    addPlaylist(playlist) {
      const exists = this.playlists.some((p) => p.id === playlist.id)
      if (!exists) {
        this.playlists.push(playlist)
      }
    },

    // 清空歌单列表
    clearPlaylists() {
      this.playlists = []
    }
  }
})
