import { describe, expect, it } from 'vitest'
import { matchLexiconTags, aggregateBehaviorEvents } from '../behaviorAggregator'

describe('behaviorAggregator', () => {
  it('matches lexicon tags from song metadata', () => {
    const tags = matchLexiconTags('夜跑 电子 周杰伦')
    expect(tags).toContain('跑步')
    expect(tags).toContain('电子')
  })

  it('aggregates weighted scores by artist and tag, sorted by score', () => {
    const profile = aggregateBehaviorEvents([
      { songName: '晴天', artist: '周杰伦', weight: 1 },
      { songName: '晴天', artist: '周杰伦', weight: 3 },
      { songName: '夜跑电子', artist: '某人', weight: 5 }
    ])

    const jay = profile.artists.find((item) => item.value === '周杰伦')
    const other = profile.artists.find((item) => item.value === '某人')
    expect(jay.score).toBe(4)
    expect(other.score).toBe(5)
    expect(profile.artists[0].value).toBe('某人')

    const tagScores = Object.fromEntries(profile.tags.map((item) => [item.value, item.score]))
    expect(tagScores['晴天']).toBe(4)
    expect(tagScores['跑步']).toBe(5)
  })

  it('drops zero scores, empty and unknown artists', () => {
    const profile = aggregateBehaviorEvents([
      { songName: 'X', artist: '', weight: 1 },
      { songName: 'Y', artist: '未知艺术家', weight: 5 },
      { songName: 'Z', artist: '周杰伦', weight: -2 },
      { songName: 'Z', artist: '周杰伦', weight: 2 }
    ])

    expect(profile.artists).toEqual([])
  })
})
