import { defineStore } from 'pinia'

export const useIndexStore = defineStore('index', {
  state: () => ({
    music_player: null,
    showPlaylist: true,
    refreshKey: 0, // 强制刷新键
    selectedPlaylistKey: null, // 当前选中的歌单 key
    isMiniMode: (() => {
      try {
        return localStorage.getItem('mini-mode') === '1'
      } catch {
        return false
      }
    })()
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
    },

    async toggleMiniMode() {
      const api = globalThis?.window?.api
      if (typeof api?.setMiniMode !== 'function') {
        console.warn('当前 preload 不支持迷你模式，请重启应用后重试')
        return
      }

      const next = !this.isMiniMode
      try {
        const result = await api.setMiniMode(next)
        if (result?.ok === false) {
          console.warn('迷你模式切换失败')
          return
        }
      } catch (error) {
        console.error('切换迷你模式失败:', error)
        return
      }

      this.isMiniMode = next
      try {
        localStorage.setItem('mini-mode', next ? '1' : '0')
      } catch {
        // 忽略存储异常
      }
    }
  }
})
