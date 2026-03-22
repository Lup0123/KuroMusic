import { defineStore } from 'pinia'

export const useIndexStore = defineStore('index', {
  state: () => ({
    music_player: null,
    showPlaylist: true,
    refreshKey: 0, // 强制刷新键
    selectedPlaylistKey: null // 当前选中的歌单 key
  }),

  actions: {
    // 设置当前选中的歌单 key
    setSelectedPlaylistKey(key) {
      this.selectedPlaylistKey = key
    },

    // 强制刷新当前页面
    forceRefresh() {
      this.refreshKey++
    },

    setMusicPlayer(player) {
      this.music_player = player
    },

    togglePlaylist() {
      this.showPlaylist = !this.showPlaylist
    }
  }
})
