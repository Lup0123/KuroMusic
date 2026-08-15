import { z } from 'zod'
import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

const RecommendSchema = z.object({
  intent: z.string().default(''),
  reason: z.string().default(''),
  artist: z.string().default(''),
  count: z.coerce.number().int().min(0).max(200).default(0),
  mood: z.string().default(''),
  language: z.string().default(''),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  adjustmentType: z.enum(['add', 'remove', 'replace', 'none']).default('none')
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
    const payload = JSON.stringify(trace, null, 2)
    writeFileSync(join(logDir, 'last-llm-trace.json'), payload, 'utf-8')

    const archiveDir = join(logDir, 'llm-traces')
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true })
    }

    const fileName = `llm-trace-${Date.now()}.json`
    writeFileSync(join(archiveDir, fileName), payload, 'utf-8')

    const files = readdirSync(archiveDir)
      .filter((name) => name.startsWith('llm-trace-') && name.endsWith('.json'))
      .sort()
    const maxKeep = 20
    if (files.length > maxKeep) {
      const staleFiles = files.slice(0, files.length - maxKeep)
      for (const stale of staleFiles) {
        try {
          unlinkSync(join(archiveDir, stale))
        } catch {
          // ignore cleanup errors
        }
      }
    }
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

function dedupeMessages(messages = [], prompt = '') {
  const normalizedPrompt = String(prompt || '').trim()
  const seen = new Set()
  const result = []

  for (const item of messages) {
    const role = item?.role === 'assistant' ? 'assistant' : 'user'
    const content = String(item?.content || '').trim()
    if (!content) continue

    if (role === 'user' && normalizedPrompt && content === normalizedPrompt) {
      continue
    }

    const key = `${role}::${content}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ role, content })
  }

  return result
}

function parseStructuredResult(rawText) {
  const text = String(rawText || '').trim()
  if (!text)
    return {
      intent: '',
      reason: '',
      artist: '',
      count: 0,
      mood: '',
      language: '',
      include: [],
      exclude: [],
      adjustmentType: 'none'
    }

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
    reason: text,
    artist: '',
    count: 0,
    mood: '',
    language: '',
    include: [],
    exclude: [],
    adjustmentType: 'none'
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
        temperature: 0.15,
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

function trimMessagesForLatency(messages = [], keepCount = 4) {
  if (!Array.isArray(messages) || messages.length <= keepCount + 1) return messages
  const head = messages[0]
  const tail = messages.slice(-keepCount)
  return [head, ...tail]
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
    ? dedupeMessages(
        messages
          .slice(-8)
          .filter((item) => item && typeof item.content === 'string')
          .map((item) => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content
          })),
        safePrompt
      )
    : []

  const requestMessages = [
    {
      role: 'system',
      content: [
        '你是音乐推荐助手。',
        '严格只返回 JSON，不要 Markdown，不要代码块，不要额外解释。',
        'JSON 结构固定：{"intent": string, "reason": string, "artist": string, "count": number, "mood": string, "language": string, "include": string[], "exclude": string[], "adjustmentType": "add"|"remove"|"replace"|"none"}。',
        'intent <=32字，reason <=120字。',
        'count 必须是数字；无法确定时填 0。',
        'artist 仅填明确歌手名；如果是“这个歌手/该歌手”这类指代，artist 置空。',
        'include/exclude 仅放短关键词，不要长句。'
      ].join(' ')
    },
    ...recentMessages,
    {
      role: 'user',
      content: safePrompt
    }
  ]

  const endpoint = `${String(targetBaseUrl).replace(/\/+$/, '')}/chat/completions`
  const baseTimeout = Number(timeoutMs) || 28000
  const attempts = promptIsLong
    ? [
        { timeout: Math.min(baseTimeout, 28000), recentCount: 3, maxTokens: 120 },
        { timeout: Math.max(baseTimeout, 36000), recentCount: 2, maxTokens: 90 }
      ]
    : [{ timeout: Math.min(baseTimeout, 24000), recentCount: 4, maxTokens: 120 }]

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
    const slicedMessages = trimMessagesForLatency([
      requestMessages[0],
      ...recentMessages.slice(-attempt.recentCount),
      requestMessages[requestMessages.length - 1]
    ])

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
        reason: parsed.reason || '',
        artist: parsed.artist || '',
        count: Number(parsed.count) || 0,
        mood: parsed.mood || '',
        language: parsed.language || '',
        include: Array.isArray(parsed.include) ? parsed.include : [],
        exclude: Array.isArray(parsed.exclude) ? parsed.exclude : [],
        adjustmentType: parsed.adjustmentType || 'none',
        llmTrace: {
          prompt: safePrompt,
          promptIsLong,
          model: targetModel,
          attemptCount: trace.attempts.length,
          latestAttempt: trace.attempts[trace.attempts.length - 1] || null
        }
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
