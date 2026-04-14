import { defineStore } from 'pinia'
import * as providerAdapter from '../services/ai/providerAdapter'
import { usePlaylistStore } from './playlistStore'

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object') return null
  return {
    ...draft,
    songs: Array.isArray(draft.songs) ? draft.songs : []
  }
}

export const useAiPlaylistStore = defineStore('aiPlaylist', {
  state: () => ({
    visible: false,
    prompt: '',
    loading: false,
    error: '',
    recommendations: [],
    draftPlaylist: null,
    creating: false,
    floatBall: {
      x: null,
      y: 120,
      dock: 'right'
    }
  }),

  actions: {
    openModal() {
      this.visible = true
    },

    closeModal() {
      this.visible = false
    },

    setPrompt(value) {
      this.prompt = String(value ?? '')
    },

    setFloatBallPosition(position = {}) {
      this.floatBall = {
        ...this.floatBall,
        ...position
      }
    },

    async generateFromPrompt(prompt) {
      this.loading = true
      this.error = ''
      const text = String(prompt ?? this.prompt).trim()
      this.prompt = text

      try {
        const result = await providerAdapter.recommend(text, { maxSongs: 30 })
        this.recommendations = Array.isArray(result?.recommendations) ? result.recommendations : []
        this.draftPlaylist = normalizeDraft(result?.draft)

        if (!this.draftPlaylist || this.draftPlaylist.songs.length === 0) {
          const message = '未找到可用歌曲，请尝试更具体或不同风格的提示词'
          this.error = message
          return {
            success: false,
            error: message,
            recommendations: this.recommendations,
            draftPlaylist: this.draftPlaylist
          }
        }

        return {
          success: true,
          recommendations: this.recommendations,
          draftPlaylist: this.draftPlaylist
        }
      } catch (error) {
        const message = getErrorMessage(error)
        this.error = message
        this.recommendations = []
        this.draftPlaylist = null

        return {
          success: false,
          error: message
        }
      } finally {
        this.loading = false
      }
    },

    async createDraftToLocalPlaylist() {
      if (!this.draftPlaylist || !Array.isArray(this.draftPlaylist.songs) || this.draftPlaylist.songs.length === 0) {
        const message = '草稿歌单为空，无法创建本地歌单'
        this.error = message
        return { success: false, reason: 'empty' }
      }

      this.creating = true
      this.error = ''

      try {
        const playlistStore = usePlaylistStore()
        const playlist = await playlistStore.createLocalPlaylist({
          name: this.draftPlaylist.name || 'AI推荐歌单',
          description: this.draftPlaylist.reason || '由 AI 推荐生成',
          songs: []
        })

        if (!playlist?.id) {
          const message = '创建本地歌单失败'
          this.error = message
          return { success: false, reason: 'create_failed' }
        }

        let addedSongs = 0
        const failedSongs = []
        for (const song of this.draftPlaylist.songs) {
          const added = await playlistStore.addSongToLocalPlaylist(playlist.id, song)
          if (added) {
            addedSongs += 1
          } else {
            failedSongs.push(song)
          }
        }

        const totalSongs = this.draftPlaylist.songs.length

        if (addedSongs === 0) {
          const message = '未能添加任何歌曲到本地歌单'
          this.error = message
          return {
            success: false,
            status: 'failed',
            reason: 'no_songs_added',
            error: message,
            playlist,
            playlistId: playlist.id,
            totalSongs,
            addedSongs,
            failedSongs
          }
        }

        return {
          success: true,
          status: addedSongs < totalSongs ? 'partial' : 'success',
          partial: addedSongs < totalSongs,
          playlist,
          playlistId: playlist.id,
          totalSongs,
          addedSongs,
          failedSongs
        }
      } catch (error) {
        const message = getErrorMessage(error)
        this.error = message
        return { success: false, error: message }
      } finally {
        this.creating = false
      }
    }
  }
})
