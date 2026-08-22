import { describe, expect, it, beforeEach, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  TAG_LEXICON,
  TAG_CATEGORIES,
  cosineSimilarity,
  findNearestTags,
  resetLexiconVectorsCache
} from '../tagLexicon'

process.env.AI_LEXICON_CACHE_PATH = join(
  tmpdir(),
  `kuromusic-lexicon-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
)

describe('tagLexicon', () => {
  beforeEach(() => {
    resetLexiconVectorsCache()
  })

  it('provides a curated lexicon with valid entries', () => {
    expect(TAG_LEXICON.length).toBeGreaterThanOrEqual(200)

    const ids = new Set()
    for (const item of TAG_LEXICON) {
      expect(item.id).toBeTruthy()
      expect(item.label).toBeTruthy()
      expect(TAG_CATEGORIES).toContain(item.category)
      expect(Array.isArray(item.aliases)).toBe(true)
      ids.add(item.id)
    }
    expect(ids.size).toBe(TAG_LEXICON.length)
  })

  it('computes cosine similarity correctly', () => {
    const a = Float32Array.from([1, 0, 0])
    const b = Float32Array.from([0, 1, 0])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
    expect(cosineSimilarity(a, Float32Array.from([1, 0]))).toBe(0)
    expect(cosineSimilarity(a, null)).toBe(0)
  })

  it('finds nearest tags with a mocked embedding', async () => {
    // One-hot vectors: each lexicon entry maps to a unique dimension.
    const embed = vi.fn(async () =>
      TAG_LEXICON.map((_, index) => {
        const vector = new Float32Array(TAG_LEXICON.length)
        vector[index] = 1
        return vector
      })
    )

    const targetIndex = 5
    const query = new Float32Array(TAG_LEXICON.length)
    query[targetIndex] = 1

    const result = await findNearestTags(query, 3, embed)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe(TAG_LEXICON[targetIndex].id)
    expect(result[0].score).toBeCloseTo(1, 5)
    expect(result.length).toBeLessThanOrEqual(3)
  })
})
