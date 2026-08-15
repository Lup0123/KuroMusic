import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GLOBAL_SHORTCUTS,
  GLOBAL_SHORTCUT_COMMANDS,
  loadGlobalShortcutConfig,
  readStoredSettings
} from '../globalShortcuts'

describe('globalShortcuts config', () => {
  it('exposes defaults for all player commands', () => {
    expect(Object.keys(DEFAULT_GLOBAL_SHORTCUTS).sort()).toEqual([
      'next',
      'previous',
      'toggle-mini',
      'toggle-play'
    ])
    expect(GLOBAL_SHORTCUT_COMMANDS['toggle-play']).toBe('播放 / 暂停')
  })

  it('enables shortcuts by default', () => {
    expect(loadGlobalShortcutConfig({}).enabled).toBe(true)
  })

  it('falls back to defaults for missing or empty shortcuts', () => {
    const config = loadGlobalShortcutConfig({
      globalShortcuts: { next: 'Ctrl+Alt+N', previous: '  ' }
    })
    expect(config.shortcuts.next).toBe('Ctrl+Alt+N')
    expect(config.shortcuts.previous).toBe(DEFAULT_GLOBAL_SHORTCUTS.previous)
    expect(config.shortcuts['toggle-play']).toBe(DEFAULT_GLOBAL_SHORTCUTS['toggle-play'])
  })

  it('reads disabled flag', () => {
    expect(loadGlobalShortcutConfig({ globalShortcutsEnabled: false }).enabled).toBe(false)
  })

  it('returns empty settings when localStorage is unavailable', () => {
    expect(readStoredSettings()).toEqual({})
  })
})