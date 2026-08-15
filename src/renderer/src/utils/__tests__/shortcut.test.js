import { describe, expect, it } from 'vitest'
import { keydownToAccelerator, formatAccelerator } from '../shortcut'

function fakeEvent(overrides = {}) {
  return {
    code: '',
    key: '',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides
  }
}

describe('keydownToAccelerator', () => {
  it('converts Ctrl+Alt+Space', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'Space', ctrlKey: true, altKey: true }))).toBe(
      'Ctrl+Alt+Space'
    )
  })

  it('maps arrow keys to Electron Left/Right/Up/Down', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'ArrowLeft', ctrlKey: true, altKey: true }))).toBe(
      'Ctrl+Alt+Left'
    )
    expect(keydownToAccelerator(fakeEvent({ code: 'ArrowRight', ctrlKey: true, altKey: true }))).toBe(
      'Ctrl+Alt+Right'
    )
    expect(keydownToAccelerator(fakeEvent({ code: 'ArrowUp', ctrlKey: true }))).toBe('Ctrl+Up')
    expect(keydownToAccelerator(fakeEvent({ code: 'ArrowDown', altKey: true }))).toBe('Alt+Down')
  })

  it('maps letters and digits', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'KeyM', ctrlKey: true, altKey: true }))).toBe(
      'Ctrl+Alt+M'
    )
    expect(keydownToAccelerator(fakeEvent({ code: 'Digit7', ctrlKey: true, shiftKey: true }))).toBe(
      'Ctrl+Shift+7'
    )
  })

  it('keeps F keys and media keys without modifiers', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'F5' }))).toBe('F5')
    expect(keydownToAccelerator(fakeEvent({ code: 'MediaPlayPause' }))).toBe('MediaPlayPause')
    expect(keydownToAccelerator(fakeEvent({ code: 'MediaTrackNext' }))).toBe('MediaNextTrack')
  })

  it('rejects plain letter keys without a modifier', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'KeyA' }))).toBeNull()
  })

  it('rejects modifier-only presses and punctuation', () => {
    expect(keydownToAccelerator(fakeEvent({ code: 'ControlLeft', ctrlKey: true }))).toBeNull()
    expect(keydownToAccelerator(fakeEvent({ code: 'Semicolon', ctrlKey: true }))).toBeNull()
  })
})

describe('formatAccelerator', () => {
  it('formats arrow keys and space into readable text', () => {
    expect(formatAccelerator('Ctrl+Alt+Left')).toBe('Ctrl+Alt+←')
    expect(formatAccelerator('Ctrl+Alt+Space')).toBe('Ctrl+Alt+空格')
  })

  it('shows Win for Super', () => {
    expect(formatAccelerator('Super+Alt+M')).toBe('Win+Alt+M')
  })

  it('returns 未设置 for empty or invalid input', () => {
    expect(formatAccelerator('')).toBe('未设置')
    expect(formatAccelerator(null)).toBe('未设置')
  })
})