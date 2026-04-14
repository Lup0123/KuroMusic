import { recommendByRule } from './ruleProvider'

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
  const result = await recommendByRule(prompt, context)
  return assertProviderResultShape(result)
}
