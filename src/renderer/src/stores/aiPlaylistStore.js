import { defineStore } from 'pinia'
import * as providerAdapter from '../services/ai/providerAdapter'
import { usePlaylistStore } from './playlistStore'

const RERANK_AUTO_THRESHOLD = 40
const RERANK_MIN_COUNT = 10

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
      return 'AI服务鉴权失败，请检查设置中的 Alibaba API Key。'
    case 'rate_limit':
      return 'AI服务触发限流，请稍后重试。'
    case 'timeout':
      return 'AI请求超时，已启用兜底结果。'
    case 'network':
      return 'AI网络请求失败，请检查网络后重试。'
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
      lastCreateResult: null,
      excludeSongIds: []
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

function requestVisualFrame(callback) {
  if (typeof globalThis?.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }
  return setTimeout(() => callback(Date.now()), 16)
}

function cancelVisualFrame(handle) {
  if (handle == null) return
  if (typeof globalThis?.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }
  clearTimeout(handle)
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
      excludeSongIds: [],
      providerMode: 'llm',
      recentPrompts: [],
      generationMetrics: [],
      lastLlmTraceSummary: null,
      reranking: false,
      rerankHighlights: [],
      rerankError: '',
      chatMode: 'recommend',
      streaming: false,
      streamingMessageId: null,
      streamBuffer: '',
      streamFlushIntervalMs: 24,
      lastStreamFlushAt: 0,
      streamFlushScheduled: false,
      streamFlushFrameHandle: null,
      streamRequestId: '',
      streamCleanup: [],
      streamReconnectAttempt: 0,
      streamReconnectTimer: null,
      streamMaxReconnectAttempts: 2,
      streamReconnectBaseDelayMs: 800,
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
      this.excludeSongIds = Array.isArray(session.excludeSongIds) ? session.excludeSongIds : []
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
      session.excludeSongIds = Array.isArray(this.excludeSongIds) ? this.excludeSongIds : []
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
      const allowedModes = new Set(['llm'])
      this.providerMode = allowedModes.has(mode) ? mode : 'llm'
      this.persistStoreState()
    },

    setChatMode(mode) {
      this.chatMode = mode === 'chat' ? 'chat' : 'recommend'
    },

    addChatMessage(role, content, meta = {}) {
      const { provider = 'rule', type = 'text', error = false, ...restMeta } = meta || {}
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.chatMessages.push({
        id,
        role,
        content: String(content ?? ''),
        time: Date.now(),
        provider,
        type,
        error: Boolean(error),
        meta: restMeta
      })
      return id
    },

    updateChatMessageById(messageId, patch = {}) {
      if (!messageId) return false
      const target = this.chatMessages.find((item) => item.id === messageId)
      if (!target) return false

      const nextMeta = patch.meta ? { ...(target.meta || {}), ...(patch.meta || {}) } : target.meta

      Object.assign(target, {
        ...patch,
        meta: nextMeta,
        time: Date.now()
      })
      return true
    },

    startStreamingAssistantMessage() {
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.chatMessages.push({
        id: messageId,
        role: 'assistant',
        content: '思考中...',
        time: Date.now(),
        provider: 'llm',
        type: 'streaming',
        error: false,
        meta: { placeholder: true }
      })
      this.streaming = true
      this.streamingMessageId = messageId
      this.streamBuffer = ''
      this.lastStreamFlushAt = 0
      this.streamFlushScheduled = false
      this.streamFlushFrameHandle = null
      return messageId
    },

    cancelScheduledStreamFlush() {
      if (this.streamFlushFrameHandle != null) {
        cancelVisualFrame(this.streamFlushFrameHandle)
      }
      this.streamFlushFrameHandle = null
      this.streamFlushScheduled = false
    },

    scheduleStreamFlush() {
      if (this.streamFlushScheduled || !this.streamingMessageId) return
      this.streamFlushScheduled = true
      this.streamFlushFrameHandle = requestVisualFrame(() => {
        this.streamFlushScheduled = false
        this.streamFlushFrameHandle = null
        this.flushStreamingBuffer(false)
        if (this.streamBuffer) {
          this.scheduleStreamFlush()
        }
      })
    },

    flushStreamingBuffer(force = false) {
      if (!this.streamingMessageId || !this.streamBuffer) return
      const now = Date.now()
      if (!force && now - this.lastStreamFlushAt < this.streamFlushIntervalMs) {
        this.scheduleStreamFlush()
        return
      }

      const target = this.chatMessages.find((item) => item.id === this.streamingMessageId)
      if (!target) return
      if (target?.meta?.placeholder) {
        target.content = ''
        target.meta = {
          ...(target.meta || {}),
          placeholder: false
        }
      }
      target.content = `${target.content || ''}${this.streamBuffer}`
      target.time = now
      this.streamBuffer = ''
      this.lastStreamFlushAt = now
    },

    appendStreamingToken(token) {
      this.streamBuffer += String(token || '')
      this.scheduleStreamFlush()
    },

    finishStreamingMessage(meta = {}) {
      this.cancelScheduledStreamFlush()
      this.flushStreamingBuffer(true)
      const target = this.chatMessages.find((item) => item.id === this.streamingMessageId)
      if (target) {
        target.type = 'text'
        target.meta = {
          ...(target.meta || {}),
          ...meta
        }
      }
      this.streaming = false
      this.streamingMessageId = null
      this.streamBuffer = ''
      this.lastStreamFlushAt = 0
      this.streamFlushScheduled = false
      this.streamFlushFrameHandle = null
      this.streamRequestId = ''
    },

    clearStreamListeners() {
      for (const off of this.streamCleanup) {
        try {
          off?.()
        } catch {
          // ignore
        }
      }
      this.streamCleanup = []
    },

    clearStreamReconnectTimer() {
      if (this.streamReconnectTimer) {
        clearTimeout(this.streamReconnectTimer)
        this.streamReconnectTimer = null
      }
    },

    getStreamingAssistantContent() {
      if (!this.streamingMessageId) return ''
      const target = this.chatMessages.find((item) => item.id === this.streamingMessageId)
      return String(target?.content || '')
    },

    shouldAutoReconnectStream(payload = {}) {
      const code = String(payload?.code || payload?.errorCode || '').toLowerCase()
      if (code === 'timeout' || code === 'network') return true

      const message = String(payload?.message || payload?.error || '').toLowerCase()
      return (
        message.includes('network') ||
        message.includes('fetch failed') ||
        message.includes('timed out') ||
        message.includes('timeout')
      )
    },

    getStreamReconnectDelayMs(attempt) {
      const safeAttempt = Math.max(1, Number(attempt) || 1)
      const delay = this.streamReconnectBaseDelayMs * 2 ** (safeAttempt - 1)
      return Math.min(4000, delay)
    },

    async startDiscussionStream(prompt) {
      const baseRequestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.clearStreamListeners()
      this.clearStreamReconnectTimer()
      this.streamReconnectAttempt = 0
      this.startStreamingAssistantMessage()

      return new Promise((resolve, reject) => {
        let settled = false

        const finishOk = (result) => {
          if (settled) return
          settled = true
          this.clearStreamListeners()
          this.clearStreamReconnectTimer()
          this.streamReconnectAttempt = 0
          resolve(result)
        }

        const finishError = (message, payload = {}) => {
          if (settled) return
          settled = true
          this.finishStreamingMessage({
            error: true,
            code: payload?.code || payload?.errorCode || ''
          })
          this.error = String(message || 'AI 对话失败')
          this.addChatMessage('assistant', this.error, {
            provider: 'llm',
            type: 'error',
            error: true,
            reason: this.error
          })
          this.clearStreamListeners()
          this.clearStreamReconnectTimer()
          this.streamReconnectAttempt = 0
          reject(new Error(this.error))
        }

        const startAttempt = async () => {
          if (settled || !this.loading) return

          const attempt = this.streamReconnectAttempt
          const requestId =
            attempt > 0 ? `${baseRequestId}-retry-${attempt}` : `${baseRequestId}-attempt-0`
          this.streamRequestId = requestId
          this.clearStreamListeners()

          const offChunk = globalThis?.window?.api?.onAiChatStreamChunk?.((payload) => {
            if (!payload || payload.requestId !== this.streamRequestId) return
            this.appendStreamingToken(payload.token)
          })

          const offEnd = globalThis?.window?.api?.onAiChatStreamEnd?.((payload) => {
            if (!payload || payload.requestId !== this.streamRequestId) return
            this.finishStreamingMessage({ finishReason: payload.finishReason || 'stop' })
            finishOk({ success: true, requestId: payload.requestId })
          })

          const offError = globalThis?.window?.api?.onAiChatStreamError?.((payload) => {
            if (!payload || payload.requestId !== this.streamRequestId || settled) return

            const canRetry =
              this.shouldAutoReconnectStream(payload) &&
              this.streamReconnectAttempt < this.streamMaxReconnectAttempts &&
              this.loading

            if (canRetry) {
              this.streamReconnectAttempt += 1
              const current = this.streamReconnectAttempt
              const delay = this.getStreamReconnectDelayMs(current)
              this.addChatMessage(
                'assistant',
                `网络中断，正在自动重连（${current}/${this.streamMaxReconnectAttempts}）...`,
                {
                  provider: 'llm',
                  type: 'status',
                  reason: 'stream_reconnect'
                }
              )
              this.clearStreamListeners()
              this.clearStreamReconnectTimer()
              this.streamReconnectTimer = setTimeout(() => {
                this.streamReconnectTimer = null
                startAttempt()
              }, delay)
              return
            }

            finishError(String(payload.message || 'AI 对话失败'), payload)
          })

          this.streamCleanup = [offChunk, offEnd, offError].filter(Boolean)

          try {
            const resumeFrom = this.getStreamingAssistantContent().slice(-240)
            const result = await globalThis.window.api.aiChatStream({
              requestId,
              prompt,
              timeoutMs: 35000,
              resumeFrom,
              messages: this.chatMessages
                .filter((item) => item?.role === 'user' || item?.role === 'assistant')
                .map((item) => ({ role: item.role, content: item.content }))
            })

            if (!result?.success && result?.requestId === this.streamRequestId) {
              const canRetry =
                this.shouldAutoReconnectStream(result) &&
                this.streamReconnectAttempt < this.streamMaxReconnectAttempts &&
                this.loading
              if (!canRetry) {
                finishError(String(result?.error || 'AI 对话失败'), result)
              }
            }
          } catch (error) {
            if (!settled) {
              const payload = { code: 'network', message: error?.message || 'AI 对话失败' }
              const canRetry =
                this.shouldAutoReconnectStream(payload) &&
                this.streamReconnectAttempt < this.streamMaxReconnectAttempts &&
                this.loading
              if (canRetry) {
                this.streamReconnectAttempt += 1
                const current = this.streamReconnectAttempt
                const delay = this.getStreamReconnectDelayMs(current)
                this.addChatMessage(
                  'assistant',
                  `网络中断，正在自动重连（${current}/${this.streamMaxReconnectAttempts}）...`,
                  {
                    provider: 'llm',
                    type: 'status',
                    reason: 'stream_reconnect'
                  }
                )
                this.clearStreamListeners()
                this.clearStreamReconnectTimer()
                this.streamReconnectTimer = setTimeout(() => {
                  this.streamReconnectTimer = null
                  startAttempt()
                }, delay)
              } else {
                finishError(payload.message, payload)
              }
            }
          }
        }

        startAttempt()
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

      if (this.chatMode === 'chat') {
        try {
          const streamResult = await this.startDiscussionStream(text)
          if (!streamResult?.success) {
            const message = String(streamResult?.error || 'AI 对话失败')
            this.error = message
            return { success: false, error: message }
          }
          return { success: true, mode: 'chat' }
        } catch (error) {
          const message = getErrorMessage(error)
          this.error = message
          return { success: false, error: message }
        } finally {
          this.syncToSession()
          if (requestId === this.activeRequestId) {
            this.loading = false
          }
          this.canceledRequestIds = this.canceledRequestIds.filter((id) => id !== requestId)
        }
      }

      try {
        const pendingRecommendationMessageId = this.addChatMessage(
          'assistant',
          '收到，正在为你整理歌单候选...',
          {
            provider: 'llm',
            type: 'status',
            reason: 'recommend_pending'
          }
        )

        const isAdjustment =
          this.chatMessages.filter((item) => item.role === 'user').length > 1 &&
          Array.isArray(this.draftPlaylist?.songs) &&
          this.draftPlaylist.songs.length > 0

        const llmMessages = this.chatMessages
          .filter((item) => {
            const type = String(item?.type || 'text')
            const content = String(item?.content || '')

            if (type === 'status' || type === 'error') return false
            if (content.startsWith('已应用本次调整')) return false
            if (content.startsWith('LLM原始错误')) return false
            return item?.role === 'user' || item?.role === 'assistant'
          })
          .slice(-6)
          .map((item) => ({ role: item.role, content: item.content }))

        const result = await providerAdapter.recommend(text, {
          maxSongs: 30,
          useLLM: true,
          providerMode: this.providerMode,
          messages: llmMessages,
          baseSongs: this.draftPlaylist?.songs || [],
          excludeSongIds: this.excludeSongIds || []
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

        if (
          !this.pendingDraftPlaylist &&
          (this.draftPlaylist?.songs?.length || 0) >= RERANK_AUTO_THRESHOLD
        ) {
          this.rerankDraft()
        }

        const metric = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: text,
          provider: result?.debug?.provider || 'llm',
          fallback: Boolean(result?.debug?.fallback),
          llmErrorType: result?.debug?.llmErrorType || '',
          success: Boolean(draftForMessage?.songs?.length),
          generatedSongCount: draftForMessage?.songs?.length || 0,
          time: Date.now()
        }
        this.generationMetrics = [...this.generationMetrics.slice(-19), metric]
        this.lastLlmTraceSummary = result?.debug?.llmTrace || null

        const assistantText = draftForMessage?.songs?.length
          ? `已根据你的描述生成「${draftForMessage.name}」，共 ${draftForMessage.songs.length} 首歌。`
          : '我暂时没有找到合适歌曲，可以换个描述再试一次。'
        this.updateChatMessageById(pendingRecommendationMessageId, {
          content: assistantText,
          provider: result?.debug?.provider || 'llm',
          type: 'recommendation',
          error: false,
          meta: {
            intent: result?.debug?.intent || '',
            reason: result?.debug?.reason || ''
          }
        })

        if (result?.debug?.fallback) {
          const fallbackMessage = mapLlmErrorTypeToMessage(result?.debug?.llmErrorType)
          if (fallbackMessage) {
            this.addChatMessage('assistant', fallbackMessage, {
              provider: 'llm',
              type: 'status',
              reason: result?.debug?.llmErrorType || 'unknown'
            })
          }

          if (result?.debug?.llmErrorMessage) {
            this.addChatMessage('assistant', `LLM原始错误：${result.debug.llmErrorMessage}`, {
              provider: 'llm',
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
          provider: 'llm',
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

    async rerankDraft() {
      const targetDraft = this.draftPlaylist
      const songs = (targetDraft?.songs || []).slice(0, 60)
      if (this.reranking) {
        return { success: false, reason: 'busy' }
      }
      if (songs.length < RERANK_MIN_COUNT) {
        return { success: false, reason: 'too_few' }
      }

      this.reranking = true
      this.rerankError = ''
      try {
        const payload = {
          songs: songs.map((song) => ({
            id: song.id,
            name: song.name,
            artist: song.artist
          })),
          timeoutMs: 20000
        }
        const result = await globalThis.window.api.aiRerankCandidates(payload)
        if (!result?.success || !Array.isArray(result.order)) {
          this.rerankError = String(result?.error || '精排失败，已保留原排序')
          return { success: false, error: this.rerankError }
        }

        if (this.draftPlaylist !== targetDraft) {
          return { success: false, reason: 'stale' }
        }

        const orderMap = new Map(result.order.map((id, index) => [String(id), index]))
        const sorted = [...songs].sort((a, b) => {
          const indexA = orderMap.has(String(a.id))
            ? orderMap.get(String(a.id))
            : Number.MAX_SAFE_INTEGER
          const indexB = orderMap.has(String(b.id))
            ? orderMap.get(String(b.id))
            : Number.MAX_SAFE_INTEGER
          return indexA - indexB
        })
        const highlights = (result.highlights || []).slice(0, 3).map((item) => ({
          id: String(item.id),
          reason: String(item.reason || '')
        }))

        this.draftPlaylist = { ...targetDraft, songs: sorted }
        if (Array.isArray(this.recommendations)) {
          this.recommendations = this.recommendations.map((recommendation) => ({
            ...recommendation,
            songs: Array.isArray(recommendation.songs)
              ? sorted.slice(0, recommendation.songs.length)
              : recommendation.songs,
            highlights
          }))
        }
        this.rerankHighlights = highlights
        this.syncToSession()

        if (highlights.length > 0) {
          const reasonText = highlights
            .map((item) => {
              const song = sorted.find(
                (candidate) => String(candidate.id) === String(item.id)
              )
              return song ? `「${song.name}」${item.reason}` : item.reason
            })
            .join('；')
          this.addChatMessage(
            'assistant',
            `已按相关性精排。精选理由：${reasonText}`,
            {
              provider: 'llm',
              type: 'status',
              reason: 'rerank_done'
            }
          )
        } else {
          this.addChatMessage('assistant', '已按相关性重新排序候选歌单。', {
            provider: 'llm',
            type: 'status',
            reason: 'rerank_done'
          })
        }

        return { success: true, highlights }
      } catch (error) {
        this.rerankError = getErrorMessage(error)
        return { success: false, error: this.rerankError }
      } finally {
        this.reranking = false
      }
    },

    removeSongFromDraft(songId) {
      const id = String(songId ?? '')
      if (!id) return false

      const removeFromList = (songs = []) =>
        songs.filter((song) => String(song?.id ?? '') !== id)

      if (this.draftPlaylist?.songs?.length) {
        this.draftPlaylist = {
          ...this.draftPlaylist,
          songs: removeFromList(this.draftPlaylist.songs)
        }
      }
      if (this.pendingDraftPlaylist?.songs?.length) {
        this.pendingDraftPlaylist = {
          ...this.pendingDraftPlaylist,
          songs: removeFromList(this.pendingDraftPlaylist.songs)
        }
      }

      if (!this.excludeSongIds.includes(id)) {
        this.excludeSongIds = [...this.excludeSongIds, id]
      }
      this.syncToSession()
      return true
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
        lastLlmTraceSummary: this.lastLlmTraceSummary,
        recentPrompts: [...this.recentPrompts],
        lastCreateResult: this.lastCreateResult
      }
    },

    persistStoreState() {
      const payload = {
        providerMode: this.providerMode,
        recentPrompts: this.recentPrompts,
        generationMetrics: this.generationMetrics,
        lastLlmTraceSummary: this.lastLlmTraceSummary,
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
      this.providerMode = ['auto', 'llm', 'rule'].includes(restored.providerMode) ? 'llm' : 'llm'
      this.recentPrompts = Array.isArray(restored.recentPrompts)
        ? restored.recentPrompts.slice(0, 10)
        : []
      this.generationMetrics = Array.isArray(restored.generationMetrics)
        ? restored.generationMetrics.slice(-20)
        : []
      this.lastLlmTraceSummary = restored.lastLlmTraceSummary || null
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
      this.clearStreamReconnectTimer()
      this.clearStreamListeners()
      this.cancelScheduledStreamFlush()
      if (this.streaming) {
        this.finishStreamingMessage({ canceled: true })
      }
      this.loading = false
      this.error = '当前 AI 生成已取消'
      this.addChatMessage('assistant', '已取消本次生成请求。', {
        provider: 'llm',
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
