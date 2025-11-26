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
    currentPlaylistSongs: [] // 当前歌单的歌曲列表
  }),

  getters: {
    // 获取当前歌单歌曲数量
    currentPlaylistSongCount: (state) => state.currentPlaylistSongs.length,

    // 获取格式化的歌单信息
    formattedCurrentPlaylist: (state) => ({
      ...state.currentPlaylistInfo,
      songCount: state.currentPlaylistSongs.length
    })
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
        liked: song.liked || false,
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
