import { z } from 'zod'
import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const RecommendSchema = z.object({
  intent: z.string().default(''),
  reason: z.string().default('')
})

const LONG_PROMPT_THRESHOLD = 36
const LONG_PROMPT_PATTERN = /(不少于|至少|超过|多一点|更多|50|100|长一点|详细一点)/

function ensureLogDir() {
  const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd()
  const logDir = join(appPath, 'log')
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return logDir
}

function persistLlmTrace(trace) {
  try {
    const logDir = ensureLogDir()
    writeFileSync(join(logDir, 'last-llm-trace.json'), JSON.stringify(trace, null, 2), 'utf-8')
  } catch {
    // never block main flow on logging
  }
}

function extractJsonCandidate(text) {
  const value = String(text || '')
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return ''
  return value.slice(start, end + 1)
}

function extractTextContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) return item.text || ''
        return ''
      })
      .join(' ')
      .trim()
  }
  return ''
}

function parseStructuredResult(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return { intent: '', reason: '' }

  try {
    const parsed = JSON.parse(text)
    const checked = RecommendSchema.safeParse(parsed)
    if (checked.success) return checked.data
  } catch {
    // continue with fallback
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1])
      const checked = RecommendSchema.safeParse(parsed)
      if (checked.success) return checked.data
    } catch {
      // ignore
    }
  }

  const extracted = extractJsonCandidate(text)
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted)
      const checked = RecommendSchema.safeParse(parsed)
      if (checked.success) return checked.data
    } catch {
      // ignore
    }
  }

  return {
    intent: text.slice(0, 80),
    reason: text
  }
}

function shouldRetry(status) {
  const code = Number(status || 0)
  return code === 408 || code === 429 || code >= 500
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestChatCompletion({ endpoint, apiKey, model, messages, timeoutMs, maxTokens }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(timeoutMs) || 35000)

  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: Number(maxTokens) || 200
      }),
      signal: controller.signal
    })
  } catch (error) {
    const err = new Error(error?.name === 'AbortError' ? 'LLM request timed out' : error?.message)
    if (error?.name === 'AbortError') err.code = 'LLM_TIMEOUT'
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function runLangChainRecommend({
  prompt,
  messages = [],
  apiKey,
  model,
  baseUrl,
  timeoutMs = 35000
}) {
  const safePrompt = String(prompt || '').trim()
  const targetModel = model || process.env.ALIBABA_MODEL || 'qwen-plus'
  const targetBaseUrl =
    baseUrl || process.env.ALIBABA_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'

  const promptIsLong =
    safePrompt.length >= LONG_PROMPT_THRESHOLD || LONG_PROMPT_PATTERN.test(safePrompt)

  const recentMessages = Array.isArray(messages)
    ? messages
        .slice(-8)
        .filter((item) => item && typeof item.content === 'string')
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content
        }))
    : []

  const requestMessages = [
    {
      role: 'system',
      content: [
        '你是音乐推荐助手。',
        '严格只返回 JSON，不要 Markdown，不要代码块，不要额外解释。',
        'JSON 结构固定：{"intent": string, "reason": string}。',
        'intent 请简洁概括用户意图（<=32字）；reason 请说明依据（<=120字）。'
      ].join(' ')
    },
    ...recentMessages,
    {
      role: 'user',
      content: safePrompt
    }
  ]

  const endpoint = `${String(targetBaseUrl).replace(/\/+$/, '')}/chat/completions`
  const attempts = promptIsLong
    ? [
        { timeout: Number(timeoutMs) || 35000, recentCount: 4, maxTokens: 180 },
        { timeout: Math.max(Number(timeoutMs) || 35000, 50000), recentCount: 2, maxTokens: 120 }
      ]
    : [
        { timeout: Number(timeoutMs) || 35000, recentCount: 8, maxTokens: 220 },
        { timeout: Math.max(Number(timeoutMs) || 35000, 50000), recentCount: 4, maxTokens: 160 }
      ]

  let lastError = null
  const trace = {
    time: Date.now(),
    prompt: safePrompt,
    model: targetModel,
    baseUrl: targetBaseUrl,
    promptIsLong,
    attempts: []
  }

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index]
    const slicedMessages = [
      requestMessages[0],
      ...recentMessages.slice(-attempt.recentCount),
      requestMessages[requestMessages.length - 1]
    ]

    try {
      const response = await requestChatCompletion({
        endpoint,
        apiKey,
        model: targetModel,
        messages: slicedMessages,
        timeoutMs: attempt.timeout,
        maxTokens: attempt.maxTokens
      })

      if (!response.ok) {
        const rawText = await response.text()
        const detail = String(rawText || '').slice(0, 500)
        trace.attempts.push({
          index,
          timeoutMs: attempt.timeout,
          recentCount: attempt.recentCount,
          maxTokens: attempt.maxTokens,
          requestMessages: slicedMessages,
          status: response.status,
          ok: false,
          error: detail
        })
        const err = new Error(`LLM HTTP ${response.status}: ${detail || response.statusText}`)
        err.status = response.status
        throw err
      }

      const payload = await response.json()
      const rawContent = payload?.choices?.[0]?.message?.content
      const parsed = parseStructuredResult(extractTextContent(rawContent))

      trace.attempts.push({
        index,
        timeoutMs: attempt.timeout,
        recentCount: attempt.recentCount,
        maxTokens: attempt.maxTokens,
        requestMessages: slicedMessages,
        status: response.status,
        ok: true,
        llmRawContent: extractTextContent(rawContent),
        parsed
      })
      trace.success = true
      trace.lastParsed = parsed
      persistLlmTrace(trace)

      return {
        intent: parsed.intent || '',
        reason: parsed.reason || ''
      }
    } catch (error) {
      lastError = error
      if (!trace.attempts.some((item) => item.index === index)) {
        trace.attempts.push({
          index,
          timeoutMs: attempt.timeout,
          recentCount: attempt.recentCount,
          maxTokens: attempt.maxTokens,
          requestMessages: slicedMessages,
          ok: false,
          error: String(error?.message || '')
        })
      }
      const canRetry =
        index < attempts.length - 1 && (error?.code === 'LLM_TIMEOUT' || shouldRetry(error?.status))
      if (!canRetry) break
      await sleep(350)
    }
  }

  trace.success = false
  trace.finalError = String(lastError?.message || 'LLM request failed')
  persistLlmTrace(trace)

  throw lastError || new Error('LLM request failed')
}
