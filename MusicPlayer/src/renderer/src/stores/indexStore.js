import { defineStore } from 'pinia'

export const useIndexStore = defineStore('index', {
  state: () => ({
    music_player: null,
    cur_index: 'mainpage', // 默认显示首页
    showPlaylist: true,
    previousIndex: 'mainpage', // 记录上一个页面
    refreshKey: 0, // 强制刷新键
    selectedPlaylistKey: null // 当前选中的歌单 key
  }),

  actions: {
    setCurIndex(index) {
      this.previousIndex = this.cur_index
      this.cur_index = index
      // 如果不是进入歌单详情页，清除歌单选中状态
      if (index !== 'PlaylistDetail') {
        this.selectedPlaylistKey = null
      }
      console.log('切换到:', this.cur_index)
    },

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
