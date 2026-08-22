import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMENSION, l2Normalize } from '../embeddingService'

describe('embeddingService', () => {
  it('exports the expected dimension', () => {
    expect(EMBEDDING_DIMENSION).toBe(512)
  })

  it('L2 normalizes vectors', () => {
    const vector = l2Normalize(Float32Array.from([3, 4]))
    expect(vector.length).toBe(2)
    const magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1])
    expect(magnitude).toBeCloseTo(1, 5)
  })

  it('normalizes a zero vector to a unit fallback without NaN', () => {
    const vector = l2Normalize(new Float32Array(4))
    for (const value of vector) {
      expect(Number.isNaN(value)).toBe(false)
    }
  })
})
