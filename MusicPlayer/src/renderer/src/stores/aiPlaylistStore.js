import { defineStore } from 'pinia'
import * as providerAdapter from '../services/ai/providerAdapter'
import { usePlaylistStore } from './playlistStore'

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function getSongFailureReason(error) {
  if (error instanceof Error && error.message) return error.message
  return '添加失败'
}

function mapLlmErrorTypeToMessage(errorType) {
  switch (errorType) {
    case 'auth':
      return 'AI服务鉴权失败，已切换到规则推荐。请检查设置中的 Alibaba API Key。'
    case 'rate_limit':
      return 'AI服务触发限流，已切换到规则推荐。稍后可重试。'
    case 'timeout':
      return 'AI请求超时，已切换到规则推荐。'
    case 'network':
      return 'AI网络请求失败，已切换到规则推荐。'
    default:
      return ''
  }
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object') return null
  return {
    ...draft,
    songs: Array.isArray(draft.songs) ? draft.songs : []
  }
}

function calculateDraftDiff(baseSongs = [], nextSongs = []) {
  const baseMap = new Map(
    (baseSongs || []).filter((song) => song?.id).map((song) => [song.id, song])
  )
  const nextMap = new Map(
    (nextSongs || []).filter((song) => song?.id).map((song) => [song.id, song])
  )

  const addedSongs = []
  const removedSongs = []

  for (const [id, song] of nextMap.entries()) {
    if (!baseMap.has(id)) addedSongs.push(song)
  }
  for (const [id, song] of baseMap.entries()) {
    if (!nextMap.has(id)) removedSongs.push(song)
  }

  return { addedSongs, removedSongs }
}

function mergeSongsBySelection({
  currentSongs,
  pendingSongs,
  addedIds,
  removedIds,
  mode = 'standard'
}) {
  const currentMap = new Map(
    (currentSongs || []).filter((song) => song?.id).map((song) => [song.id, song])
  )
  const pendingMap = new Map(
    (pendingSongs || []).filter((song) => song?.id).map((song) => [song.id, song])
  )
  const resultMap = new Map(currentMap)

  for (const id of addedIds || []) {
    if (pendingMap.has(id)) {
      resultMap.set(id, pendingMap.get(id))
    }
  }

  if (mode !== 'only_add') {
    for (const id of removedIds || []) {
      resultMap.delete(id)
    }
  }

  for (const [id, song] of pendingMap.entries()) {
    if (currentMap.has(id)) {
      resultMap.set(id, song)
    }
  }

  return Array.from(resultMap.values())
}

function createSessionTitle(seed = '') {
  const text = String(seed || '').trim()
  if (!text) return `新会话 ${daySessionLabel()}`
  return text.slice(0, 16)
}

function daySessionLabel() {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function createSessionState(title = '') {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: createSessionTitle(title),
    prompt: '',
    recommendations: [],
    chatMessages: [],
    draftPlaylist: null,
    pendingDraftPlaylist: null,
    lastCommittedDraft: null,
    lastAdjustmentMeta: null,
    pendingDraftDiff: { addedSongs: [], removedSongs: [] },
    pendingDraftSelection: { addedSongIds: [], removedSongIds: [] },
    pendingApplyMode: 'standard',
    lastCreateResult: null
  }
}

const AI_STORE_STORAGE_KEY = 'aiPlaylistStoreState'

function safeReadStoreState() {
  if (!globalThis?.localStorage) return null
  try {
    const raw = localStorage.getItem(AI_STORE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function safeWriteStoreState(payload) {
  if (!globalThis?.localStorage) return
  try {
    localStorage.setItem(AI_STORE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore persistence errors
  }
}

export const useAiPlaylistStore = defineStore('aiPlaylist', {
  state: () => {
    const initialSession = createSessionState()
    return {
      visible: false,
      prompt: '',
      loading: false,
      error: '',
      recommendations: [],
      chatMessages: [],
      draftPlaylist: null,
      pendingDraftPlaylist: null,
      lastCommittedDraft: null,
      lastAdjustmentMeta: null,
      pendingDraftDiff: {
        addedSongs: [],
        removedSongs: []
      },
      pendingDraftSelection: {
        addedSongIds: [],
        removedSongIds: []
      },
      pendingApplyMode: 'standard',
      activeRequestId: 0,
      canceledRequestIds: [],
      providerMode: 'auto',
      recentPrompts: [],
      generationMetrics: [],
      sessions: [initialSession],
      currentSessionId: initialSession.id,
      creating: false,
      lastCreateResult: null,
      floatBall: {
        x: null,
        y: 120,
        dock: 'right'
      }
    }
  },

  actions: {
    ensureCurrentSession() {
      if (!this.currentSessionId) {
        this.currentSessionId = this.sessions[0]?.id || null
      }
      return this.sessions.find((session) => session.id === this.currentSessionId) || null
    },

    syncFromSession() {
      const session = this.ensureCurrentSession()
      if (!session) return
      this.prompt = session.prompt || ''
      this.recommendations = session.recommendations || []
      this.chatMessages = session.chatMessages || []
      this.draftPlaylist = session.draftPlaylist || null
      this.pendingDraftPlaylist = session.pendingDraftPlaylist || null
      this.lastCommittedDraft = session.lastCommittedDraft || null
      this.lastAdjustmentMeta = session.lastAdjustmentMeta || null
      this.pendingDraftDiff = session.pendingDraftDiff || { addedSongs: [], removedSongs: [] }
      this.pendingDraftSelection = session.pendingDraftSelection || {
        addedSongIds: [],
        removedSongIds: []
      }
      this.pendingApplyMode = session.pendingApplyMode || 'standard'
      this.lastCreateResult = session.lastCreateResult || null
    },

    syncToSession() {
      const session = this.ensureCurrentSession()
      if (!session) return
      session.prompt = this.prompt
      session.recommendations = this.recommendations
      session.chatMessages = this.chatMessages
      session.draftPlaylist = this.draftPlaylist
      session.pendingDraftPlaylist = this.pendingDraftPlaylist
      session.lastCommittedDraft = this.lastCommittedDraft
      session.lastAdjustmentMeta = this.lastAdjustmentMeta
      session.pendingDraftDiff = this.pendingDraftDiff
      session.pendingDraftSelection = this.pendingDraftSelection
      session.pendingApplyMode = this.pendingApplyMode
      session.lastCreateResult = this.lastCreateResult
      this.persistStoreState()
    },

    createSession(title = '') {
      const session = createSessionState(title)
      this.sessions = [session, ...this.sessions]
      this.currentSessionId = session.id
      this.syncFromSession()
      this.persistStoreState()
      return session.id
    },

    switchSession(sessionId) {
      const found = this.sessions.find((session) => session.id === sessionId)
      if (!found) return false
      this.currentSessionId = sessionId
      this.syncFromSession()
      this.persistStoreState()
      return true
    },

    renameSession(sessionId, title) {
      const target = this.sessions.find((session) => session.id === sessionId)
      if (!target) return false
      const normalized = String(title || '').trim()
      if (!normalized) return false
      target.title = normalized.slice(0, 20)
      this.persistStoreState()
      return true
    },

    deleteSession(sessionId) {
      if (this.sessions.length <= 1) return false
      const index = this.sessions.findIndex((session) => session.id === sessionId)
      if (index < 0) return false

      const removedCurrent = this.currentSessionId === sessionId
      this.sessions.splice(index, 1)

      if (removedCurrent) {
        const fallback = this.sessions[Math.min(index, this.sessions.length - 1)]
        this.currentSessionId = fallback?.id || null
        this.syncFromSession()
      }

      this.persistStoreState()
      return true
    },

    reorderSessions(fromIndex, toIndex) {
      const from = Number(fromIndex)
      const to = Number(toIndex)
      const max = this.sessions.length - 1

      if (!Number.isInteger(from) || !Number.isInteger(to)) return false
      if (from < 0 || to < 0 || from > max || to > max) return false
      if (from === to) return true

      const next = [...this.sessions]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      this.sessions = next
      this.persistStoreState()
      return true
    },

    openModal() {
      this.ensureCurrentSession()
      this.visible = true
    },

    closeModal() {
      this.visible = false
    },

    setPrompt(value) {
      this.prompt = String(value ?? '')
    },

    setProviderMode(mode) {
      const allowedModes = new Set(['auto', 'llm', 'rule'])
      this.providerMode = allowedModes.has(mode) ? mode : 'auto'
      this.persistStoreState()
    },

    addChatMessage(role, content, meta = {}) {
      const { provider = 'rule', type = 'text', error = false, ...restMeta } = meta || {}
      this.chatMessages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content: String(content ?? ''),
        time: Date.now(),
        provider,
        type,
        error: Boolean(error),
        meta: restMeta
      })
    },

    setFloatBallPosition(position = {}) {
      this.floatBall = {
        ...this.floatBall,
        ...position
      }
    },

    async generateFromPrompt(prompt) {
      this.ensureCurrentSession()
      const requestId = this.activeRequestId + 1
      this.activeRequestId = requestId
      this.loading = true
      this.error = ''
      const text = String(prompt ?? this.prompt).trim()
      this.prompt = text

      if (text) {
        const deduped = [text, ...this.recentPrompts.filter((item) => item !== text)]
        this.recentPrompts = deduped.slice(0, 10)
        this.persistStoreState()
      }

      if (text) {
        this.addChatMessage('user', text)
      }

      try {
        const isAdjustment =
          this.chatMessages.filter((item) => item.role === 'user').length > 1 &&
          Array.isArray(this.draftPlaylist?.songs) &&
          this.draftPlaylist.songs.length > 0

        const llmMessages = this.chatMessages
          .slice(-8)
          .map((item) => ({ role: item.role, content: item.content }))

        const result = await providerAdapter.recommend(text, {
          maxSongs: 30,
          useLLM: true,
          providerMode: this.providerMode,
          messages: llmMessages,
          baseSongs: this.draftPlaylist?.songs || []
        })

        if (requestId !== this.activeRequestId || this.canceledRequestIds.includes(requestId)) {
          return {
            success: false,
            canceled: true,
            reason: 'stale_or_canceled'
          }
        }

        this.recommendations = Array.isArray(result?.recommendations) ? result.recommendations : []
        const normalizedDraft = normalizeDraft(result?.draft)

        if (isAdjustment && normalizedDraft) {
          this.pendingDraftPlaylist = normalizedDraft
          this.lastAdjustmentMeta = {
            intent: result?.debug?.intent || '',
            reason: result?.debug?.reason || normalizedDraft.reason || ''
          }
          this.pendingDraftDiff = calculateDraftDiff(
            this.draftPlaylist?.songs || [],
            normalizedDraft.songs
          )
          this.pendingDraftSelection = {
            addedSongIds: this.pendingDraftDiff.addedSongs.map((song) => song.id),
            removedSongIds: this.pendingDraftDiff.removedSongs.map((song) => song.id)
          }
          this.pendingApplyMode = 'standard'
        } else {
          this.pendingDraftPlaylist = null
          this.lastAdjustmentMeta = null
          this.pendingDraftDiff = { addedSongs: [], removedSongs: [] }
          this.pendingDraftSelection = { addedSongIds: [], removedSongIds: [] }
          this.pendingApplyMode = 'standard'
          this.draftPlaylist = normalizedDraft

          const session = this.ensureCurrentSession()
          if (session && session.title.startsWith('新会话') && text) {
            session.title = createSessionTitle(text)
          }
        }

        const draftForMessage = this.pendingDraftPlaylist || this.draftPlaylist
        const metric = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: text,
          provider: result?.debug?.provider || 'rule',
          fallback: result?.debug?.fallback === 'rule',
          llmErrorType: result?.debug?.llmErrorType || '',
          success: Boolean(draftForMessage?.songs?.length),
          generatedSongCount: draftForMessage?.songs?.length || 0,
          time: Date.now()
        }
        this.generationMetrics = [...this.generationMetrics.slice(-19), metric]

        const assistantText = draftForMessage?.songs?.length
          ? `已根据你的描述生成「${draftForMessage.name}」，共 ${draftForMessage.songs.length} 首歌。`
          : '我暂时没有找到合适歌曲，可以换个描述再试一次。'
        this.addChatMessage('assistant', assistantText, {
          provider: result?.debug?.provider || 'rule',
          type: 'recommendation',
          intent: result?.debug?.intent || '',
          reason: result?.debug?.reason || ''
        })

        if (result?.debug?.fallback === 'rule') {
          const fallbackMessage = mapLlmErrorTypeToMessage(result?.debug?.llmErrorType)
          if (fallbackMessage) {
            this.addChatMessage('assistant', fallbackMessage, {
              provider: 'rule',
              type: 'status',
              reason: result?.debug?.llmErrorType || 'unknown'
            })
          }

          if (result?.debug?.llmErrorMessage) {
            this.addChatMessage('assistant', `LLM原始错误：${result.debug.llmErrorMessage}`, {
              provider: 'rule',
              type: 'status',
              reason: result?.debug?.llmErrorType || 'unknown'
            })
          }
        }

        if (!draftForMessage || draftForMessage.songs.length === 0) {
          const message = '未找到可用歌曲，请尝试更具体或不同风格的提示词'
          this.error = message
          return {
            success: false,
            error: message,
            recommendations: this.recommendations,
            draftPlaylist: draftForMessage
          }
        }

        return {
          success: true,
          recommendations: this.recommendations,
          draftPlaylist: draftForMessage
        }
      } catch (error) {
        if (requestId !== this.activeRequestId || this.canceledRequestIds.includes(requestId)) {
          return {
            success: false,
            canceled: true,
            reason: 'stale_or_canceled'
          }
        }

        const message = getErrorMessage(error)
        this.error = message
        this.recommendations = []
        this.draftPlaylist = null
        this.addChatMessage('assistant', message, {
          provider: 'rule',
          type: 'error',
          error: true,
          reason: message
        })

        return {
          success: false,
          error: message
        }
      } finally {
        this.syncToSession()
        if (requestId === this.activeRequestId) {
          this.loading = false
        }
        this.canceledRequestIds = this.canceledRequestIds.filter((id) => id !== requestId)
      }
    },

    buildDebugSnapshot() {
      return {
        exportedAt: Date.now(),
        prompt: this.prompt,
        providerMode: this.providerMode,
        draftSongCount: this.draftPlaylist?.songs?.length || 0,
        pendingDraftSongCount: this.pendingDraftPlaylist?.songs?.length || 0,
        chatMessages: this.chatMessages.slice(-20),
        generationMetrics: [...this.generationMetrics],
        recentPrompts: [...this.recentPrompts],
        lastCreateResult: this.lastCreateResult
      }
    },

    persistStoreState() {
      const payload = {
        providerMode: this.providerMode,
        recentPrompts: this.recentPrompts,
        generationMetrics: this.generationMetrics,
        sessions: this.sessions,
        currentSessionId: this.currentSessionId
      }
      safeWriteStoreState(payload)
      return payload
    },

    restoreStoreState() {
      const restored = safeReadStoreState()
      if (!restored) return false

      const sessions = Array.isArray(restored.sessions) ? restored.sessions : []
      if (sessions.length === 0) return false

      this.sessions = sessions
      this.currentSessionId = restored.currentSessionId || sessions[0].id
      this.providerMode = ['auto', 'llm', 'rule'].includes(restored.providerMode)
        ? restored.providerMode
        : 'auto'
      this.recentPrompts = Array.isArray(restored.recentPrompts)
        ? restored.recentPrompts.slice(0, 10)
        : []
      this.generationMetrics = Array.isArray(restored.generationMetrics)
        ? restored.generationMetrics.slice(-20)
        : []
      this.syncFromSession()
      return true
    },

    initializeStore() {
      const restored = this.restoreStoreState()
      if (!restored) {
        this.syncToSession()
      }
      return restored
    },

    async reusePromptByIndex(index) {
      const prompt = this.recentPrompts[index]
      if (!prompt) {
        return { success: false, reason: 'invalid_prompt_index' }
      }

      this.setPrompt(prompt)
      return this.generateFromPrompt(prompt)
    },

    cancelCurrentGeneration() {
      if (!this.loading || !this.activeRequestId) return false
      if (!this.canceledRequestIds.includes(this.activeRequestId)) {
        this.canceledRequestIds = [...this.canceledRequestIds, this.activeRequestId]
      }
      this.loading = false
      this.error = '当前 AI 生成已取消'
      this.addChatMessage('assistant', '已取消本次生成请求。', {
        provider: 'rule',
        type: 'status',
        reason: 'user_canceled'
      })
      this.syncToSession()
      return true
    },

    async createDraftToLocalPlaylist() {
      if (this.pendingDraftPlaylist) {
        this.applyPendingDraft()
      }

      if (
        !this.draftPlaylist ||
        !Array.isArray(this.draftPlaylist.songs) ||
        this.draftPlaylist.songs.length === 0
      ) {
        const message = '草稿歌单为空，无法创建本地歌单'
        this.error = message
        return { success: false, reason: 'empty' }
      }

      this.creating = true
      this.error = ''
      this.lastCreateResult = null

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
        const failedSongDetails = []
        for (const song of this.draftPlaylist.songs) {
          try {
            const added = await playlistStore.addSongToLocalPlaylist(playlist.id, song)
            if (added) {
              addedSongs += 1
            } else {
              failedSongs.push(song)
              failedSongDetails.push({
                song,
                reason: '添加失败'
              })
            }
          } catch (error) {
            failedSongs.push(song)
            failedSongDetails.push({
              song,
              reason: getSongFailureReason(error)
            })
          }
        }

        const totalSongs = this.draftPlaylist.songs.length

        if (addedSongs === 0) {
          const message = '未能添加任何歌曲到本地歌单'
          this.error = message
          const result = {
            success: false,
            status: 'failed',
            reason: 'no_songs_added',
            error: message,
            playlist,
            playlistId: playlist.id,
            totalSongs,
            addedSongs,
            failedSongs,
            failedSongDetails
          }
          this.lastCreateResult = result
          return result
        }

        const result = {
          success: true,
          status: addedSongs < totalSongs ? 'partial' : 'success',
          partial: addedSongs < totalSongs,
          playlist,
          playlistId: playlist.id,
          totalSongs,
          addedSongs,
          failedSongs,
          failedSongDetails
        }
        this.lastCreateResult = result
        return result
      } catch (error) {
        const message = getErrorMessage(error)
        this.error = message
        return { success: false, error: message }
      } finally {
        this.creating = false
      }
    },

    async retryFailedSongsToLocalPlaylist() {
      const lastResult = this.lastCreateResult
      if (!lastResult?.playlistId || !Array.isArray(lastResult.failedSongs)) {
        return { success: false, reason: 'no_failed_songs' }
      }

      const retryTargets = [...lastResult.failedSongs]
      if (retryTargets.length === 0) {
        return { success: false, reason: 'no_failed_songs' }
      }

      this.creating = true
      this.error = ''

      try {
        const playlistStore = usePlaylistStore()
        let addedSongs = 0
        const failedSongs = []

        for (const song of retryTargets) {
          const added = await playlistStore.addSongToLocalPlaylist(lastResult.playlistId, song)
          if (added) {
            addedSongs += 1
          } else {
            failedSongs.push(song)
          }
        }

        const result = {
          success: addedSongs > 0,
          retried: retryTargets.length,
          addedSongs,
          failedSongs,
          playlistId: lastResult.playlistId
        }

        this.lastCreateResult = {
          ...lastResult,
          failedSongs
        }

        if (addedSongs === 0) {
          this.error = '重试失败，请稍后再试'
        }

        return result
      } catch (error) {
        const message = getErrorMessage(error)
        this.error = message
        return { success: false, error: message }
      } finally {
        this.creating = false
      }
    },

    applyPendingDraft() {
      if (!this.pendingDraftPlaylist) return false
      this.lastCommittedDraft = this.draftPlaylist ? { ...this.draftPlaylist } : null

      const mergedSongs = mergeSongsBySelection({
        currentSongs: this.draftPlaylist?.songs || [],
        pendingSongs: this.pendingDraftPlaylist?.songs || [],
        addedIds: this.pendingDraftSelection.addedSongIds,
        removedIds: this.pendingDraftSelection.removedSongIds,
        mode: this.pendingApplyMode
      })

      this.draftPlaylist = {
        ...this.pendingDraftPlaylist,
        songs: mergedSongs
      }

      this.addChatMessage(
        'assistant',
        `已应用本次调整：新增 ${this.pendingDraftSelection.addedSongIds.length} 首，移除 ${this.pendingApplyMode === 'only_add' ? 0 : this.pendingDraftSelection.removedSongIds.length} 首。`,
        {
          provider: 'llm',
          type: 'status',
          intent: this.lastAdjustmentMeta?.intent || '',
          reason: this.lastAdjustmentMeta?.reason || ''
        }
      )

      this.pendingDraftPlaylist = null
      this.pendingDraftDiff = { addedSongs: [], removedSongs: [] }
      this.pendingDraftSelection = { addedSongIds: [], removedSongIds: [] }
      this.pendingApplyMode = 'standard'
      this.syncToSession()
      return true
    },

    rollbackDraft() {
      if (!this.lastCommittedDraft) return false
      this.pendingDraftPlaylist = this.draftPlaylist ? { ...this.draftPlaylist } : null
      this.draftPlaylist = this.lastCommittedDraft
      this.lastCommittedDraft = null
      this.pendingDraftDiff = { addedSongs: [], removedSongs: [] }
      this.pendingDraftSelection = { addedSongIds: [], removedSongIds: [] }
      this.pendingApplyMode = 'standard'
      this.syncToSession()
      return true
    },

    togglePendingAddedSong(songId) {
      const id = Number(songId)
      if (!id) return
      const set = new Set(this.pendingDraftSelection.addedSongIds)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        addedSongIds: Array.from(set)
      }
    },

    togglePendingRemovedSong(songId) {
      const id = Number(songId)
      if (!id) return
      const set = new Set(this.pendingDraftSelection.removedSongIds)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        removedSongIds: Array.from(set)
      }
    },

    selectAllPendingAddedSongs() {
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        addedSongIds: this.pendingDraftDiff.addedSongs.map((song) => song.id)
      }
    },

    clearPendingAddedSongs() {
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        addedSongIds: []
      }
    },

    selectAllPendingRemovedSongs() {
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        removedSongIds: this.pendingDraftDiff.removedSongs.map((song) => song.id)
      }
    },

    clearPendingRemovedSongs() {
      this.pendingDraftSelection = {
        ...this.pendingDraftSelection,
        removedSongIds: []
      }
    },

    setPendingApplyMode(mode) {
      this.pendingApplyMode = mode === 'only_add' ? 'only_add' : 'standard'
    }
  }
})
