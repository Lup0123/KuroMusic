import { recommendByRule } from './ruleProvider'

function createTimeoutError(timeoutMs) {
  const error = new Error(`LLM request timed out after ${timeoutMs}ms`)
  error.code = 'LLM_TIMEOUT'
  return error
}

function withTimeout(promise, timeoutMs = 20000) {
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
  const status = Number(error?.status || error?.statusCode)
  const message = String(error?.message || '').toLowerCase()

  if (error?.code === 'LLM_TIMEOUT' || message.includes('timed out')) return 'timeout'
  if (
    status === 401 ||
    status === 403 ||
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

export async function recommend(prompt, context = {}) {
  const providerMode = context?.providerMode || 'auto'
  const shouldUseLLM = providerMode === 'llm' || (providerMode === 'auto' && context?.useLLM)

  if (shouldUseLLM && typeof globalThis?.window?.api?.aiRecommendPlaylist === 'function') {
    try {
      const llmResult = await withTimeout(
        globalThis.window.api.aiRecommendPlaylist(prompt, context),
        Number(context?.timeoutMs) || 20000
      )
      return assertProviderResultShape(llmResult)
    } catch (error) {
      const ruleResult = await recommendByRule(prompt, context)
      const normalizedRuleResult = {
        ...ruleResult,
        debug: {
          ...(ruleResult?.debug || {}),
          fallback: 'rule',
          llmErrorType: classifyLlmError(error)
        }
      }
      return assertProviderResultShape(normalizedRuleResult)
    }
  }

  const result = await recommendByRule(prompt, context)
  return assertProviderResultShape(result)
}
