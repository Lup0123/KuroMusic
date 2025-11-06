import { defineStore } from 'pinia'

export const useIndexStore = defineStore('index', {
  state: () => ({
    music_player: null,
    cur_index: 'mainpage', // 默认显示首页
    showPlaylist: true
  }),

  actions: {
    setCurIndex(index) {
      this.cur_index = index
      console.log('切换到:', this.cur_index)
    },

    setMusicPlayer(player) {
      this.music_player = player
    },

    togglePlaylist() {
      this.showPlaylist = !this.showPlaylist
    }
  }
})
