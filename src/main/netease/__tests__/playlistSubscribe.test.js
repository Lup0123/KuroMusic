import { describe, expect, it } from 'vitest'
import { buildSubscribeRequest, parseCookie } from '../playlistSubscribe'

describe('parseCookie', () => {
  it('parses cookie strings and keeps "=" inside values', () => {
    expect(parseCookie('MUSIC_U=abc==; __csrf=x1; ;bad')).toEqual({
      MUSIC_U: 'abc==',
      __csrf: 'x1'
    })
  })

  it('handles empty and object input', () => {
    expect(parseCookie('')).toEqual({})
    expect(parseCookie(null)).toEqual({})
    expect(parseCookie({ a: '1' })).toEqual({ a: '1' })
  })
})

describe('buildSubscribeRequest', () => {
  const base = { cookie: 'MUSIC_U=token; os=pc; appver=3.1.17', playlistId: 123 }

  it('targets subscribe / unsubscribe endpoints via eapi', () => {
    expect(buildSubscribeRequest({ ...base, subscribe: true }).uri).toBe('/api/playlist/subscribe')
    const unsub = buildSubscribeRequest({ ...base, subscribe: false })
    expect(unsub.uri).toBe('/api/playlist/unsubscribe')
    expect(unsub.crypto).toBe('eapi')
  })

  it('sends only the playlist id and never enables checkToken', () => {
    const req = buildSubscribeRequest({ ...base, subscribe: true })
    expect(req.data).toEqual({ id: 123 })
    expect(req.checkToken).toBeUndefined()
  })

  it('overrides the pc identity with iPhone and keeps the login cookie', () => {
    const { cookie } = buildSubscribeRequest({ ...base, subscribe: true, deviceId: 'DEV' })
    expect(cookie).toMatchObject({
      MUSIC_U: 'token',
      os: 'iPhone OS',
      appver: '9.0.90',
      channel: 'distribution',
      deviceId: 'DEV'
    })
  })

  it('omits deviceId when unavailable so the library default applies', () => {
    const { cookie } = buildSubscribeRequest({ ...base, subscribe: true })
    expect('deviceId' in cookie).toBe(false)
  })
})
