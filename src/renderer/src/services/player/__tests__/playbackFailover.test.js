import { describe, expect, it } from 'vitest'
import {
  QUALITY_LEVELS,
  normalizeQuality,
  getQualityFallbackChain,
  getNextFallbackQuality,
  isLocalSong,
  buildSkipFeedbackMessage
} from '../playbackFailover'

describe('playbackFailover', () => {
  it('orders quality levels from highest to lowest', () => {
    expect(QUALITY_LEVELS).toEqual(['hires', 'lossless', 'exhigh', 'higher', 'standard'])
  })

  it('normalizes unknown quality to standard', () => {
    expect(normalizeQuality('ultra')).toBe('standard')
    expect(normalizeQuality('exhigh')).toBe('exhigh')
  })

  it('builds the fallback chain from the current quality down to standard', () => {
    expect(getQualityFallbackChain('hires')).toEqual([
      'hires',
      'lossless',
      'exhigh',
      'higher',
      'standard'
    ])
    expect(getQualityFallbackChain('exhigh')).toEqual(['exhigh', 'higher', 'standard'])
    expect(getQualityFallbackChain('lossless')).toEqual([
      'lossless',
      'exhigh',
      'higher',
      'standard'
    ])
    expect(getQualityFallbackChain('standard')).toEqual(['standard'])
  })

  it('picks the next un-attempted quality level', () => {
    expect(getNextFallbackQuality('lossless', ['lossless'])).toBe('exhigh')
    expect(getNextFallbackQuality('lossless', ['lossless', 'exhigh'])).toBe('higher')
    expect(
      getNextFallbackQuality('lossless', ['lossless', 'exhigh', 'higher', 'standard'])
    ).toBeNull()
  })

  it('detects local songs by path', () => {
    expect(isLocalSong({ id: 1, path: 'C:/music/song.mp3' })).toBe(true)
    expect(isLocalSong({ id: 1, path: '   ' })).toBe(false)
    expect(isLocalSong({ id: 1 })).toBe(false)
    expect(isLocalSong(null)).toBe(false)
  })

  it('builds merged skip feedback message', () => {
    expect(buildSkipFeedbackMessage(3)).toBe('已跳过 3 首无法播放的歌曲')
    expect(buildSkipFeedbackMessage(0)).toBe('已跳过 1 首无法播放的歌曲')
  })
})
