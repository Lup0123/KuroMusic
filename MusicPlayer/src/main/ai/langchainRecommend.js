import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'

const RecommendSchema = z.object({
  intent: z.string().default(''),
  reason: z.string().default('')
})

export async function runLangChainRecommend({
  prompt,
  messages = [],
  apiKey,
  model,
  timeoutMs = 20000
}) {
  const llm = new ChatOpenAI({
    apiKey,
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    timeout: timeoutMs
  }).withStructuredOutput(RecommendSchema)

  const recentMessages = Array.isArray(messages)
    ? messages
        .slice(-8)
        .filter((item) => item && typeof item.content === 'string')
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content
        }))
    : []

  const result = await llm.invoke([
    {
      role: 'system',
      content: '你是音乐推荐助手。请基于上下文输出意图(intent)与推荐理由(reason)。'
    },
    ...recentMessages,
    {
      role: 'user',
      content: String(prompt || '')
    }
  ])

  return {
    intent: result.intent || '',
    reason: result.reason || ''
  }
}
