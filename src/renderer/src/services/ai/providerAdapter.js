function toPlainJson(value, fallback) {
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return fallback
    return JSON.parse(serialized)
  } catch {
    return fallback
  }
}

function buildIpcLlmContext(context = {}) {
  const timeoutMs = Number(context?.timeoutMs)
  return {
    apiKey: String(context?.apiKey || ''),
    model: String(context?.model || ''),
    baseUrl: String(context?.baseUrl || ''),
    timeoutMs: timeoutMs > 0 ? timeoutMs : 35000,
    messages: toPlainJson(context?.messages, []),
    baseSongs: toPlainJson(context?.baseSongs, []),
    excludeSongIds: toPlainJson(context?.excludeSongIds, [])
  }
}

function createTimeoutError(timeoutMs) {
  const error = new Error(`LLM request timed out after ${timeoutMs}ms`)
  error.code = 'LLM_TIMEOUT'
  return error
}

function withTimeout(promise, timeoutMs = 35000) {
  if (!timeoutMs || timeoutMs <= 0) return promise

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(createTimeoutError(timeoutMs))
      }, timeoutMs)
    })
  ])
}

function classifyLlmError(error) {
  const message = String(error?.message || '').toLowerCase()
  const statusFromMessage = message.match(/http\s*(\d{3})/)?.[1]
  const status = Number(error?.status || error?.statusCode || statusFromMessage)

  if (error?.code === 'LLM_TIMEOUT' || message.includes('timed out')) return 'timeout'
  if (
    status === 401 ||
    status === 403 ||
    message.includes('api key') ||
    message.includes('invalid api key') ||
    message.includes('未配置') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return 'auth'
  }
  if (status === 429 || message.includes('rate limit')) return 'rate_limit'
  if (status >= 500 || message.includes('network') || message.includes('fetch')) return 'network'
  return 'unknown'
}

export function assertProviderResultShape(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('AI provider returned empty result')
  }
  if (!Array.isArray(result.recommendations)) {
    throw new Error('AI provider result.recommendations must be an array')
  }
  if (!result.draft || typeof result.draft !== 'object') {
    throw new Error('AI provider result.draft must be an object')
  }
  if (!Array.isArray(result.draft.songs)) {
    throw new Error('AI provider result.draft.songs must be an array')
  }
  return result
}

function buildTimeoutFallbackResult(prompt, context = {}, error) {
  const baseSongs = toPlainJson(context?.baseSongs, []).filter((song) => song?.id)
  const safePrompt = String(prompt || '').trim()

  return {
    recommendations: [
      {
        id: 'llm-timeout-guard',
        title: 'AI 请求超时，已启用兜底结果',
        reason: '请求超时后保留当前草稿，避免丢失上下文',
        songs: baseSongs.slice(0, 20)
      }
    ],
    draft: {
      name: context?.draftName || 'AI超时兜底歌单',
      reason: safePrompt
        ? `请求超时，已基于当前草稿兜底（原请求：${safePrompt.slice(0, 40)}）`
        : '请求超时，已基于当前草稿兜底',
      songs: baseSongs
    },
    debug: {
      provider: 'llm',
      fallback: 'timeout_guard',
      llmErrorType: 'timeout',
      llmErrorMessage: String(error?.message || '')
    }
  }
}

export async function recommend(prompt, context = {}) {
  if (typeof globalThis?.window?.api?.aiRecommendPlaylist !== 'function') {
    throw new Error('LLM provider is unavailable')
  }

  try {
    const ipcContext = buildIpcLlmContext(context)
    const llmResult = await withTimeout(
      globalThis.window.api.aiRecommendPlaylist(prompt, ipcContext),
      Number(ipcContext?.timeoutMs) || 35000
    )

    if (llmResult && llmResult.success === false) {
      const err = new Error(llmResult.error || 'LLM provider request failed')
      err.status = llmResult.status
      throw err
    }

    return assertProviderResultShape(llmResult)
  } catch (error) {
    const llmErrorType = classifyLlmError(error)
    if (llmErrorType === 'timeout') {
      return assertProviderResultShape(buildTimeoutFallbackResult(prompt, context, error))
    }
    throw error
  }
}
