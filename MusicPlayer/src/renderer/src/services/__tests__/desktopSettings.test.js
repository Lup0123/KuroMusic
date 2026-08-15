import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUTO_CHECK_UPDATE,
  DEFAULT_CLOSE_TO_TRAY,
  applyAutoLaunch,
  fetchAutoLaunchStatus,
  readAutoCheckUpdate,
  readCloseToTray,
  syncAutoCheckUpdate,
  syncCloseToTray
} from '../desktopSettings'

function withApi(api) {
  globalThis.window = { api }
  return () => {
    delete globalThis.window
  }
}

describe('desktopSettings', () => {
  it('defaults closeToTray to enabled', () => {
    expect(DEFAULT_CLOSE_TO_TRAY).toBe(true)
    expect(readCloseToTray({})).toBe(true)
    expect(readCloseToTray({ closeToTray: true })).toBe(true)
    expect(readCloseToTray({ closeToTray: false })).toBe(false)
  })

  it('syncs closeToTray through window.api', () => {
    const setCloseToTray = vi.fn()
    const cleanup = withApi({ setCloseToTray })
    expect(syncCloseToTray({ closeToTray: false })).toBe(true)
    expect(setCloseToTray).toHaveBeenCalledWith(false)
    cleanup()
  })

  it('returns false when api is unavailable', () => {
    expect(syncCloseToTray({})).toBe(false)
  })

  it('applies auto-launch with boolean coercion', async () => {
    const setAutoLaunch = vi.fn().mockResolvedValue({ ok: true, enabled: true })
    const cleanup = withApi({ setAutoLaunch })
    const result = await applyAutoLaunch(1)
    expect(setAutoLaunch).toHaveBeenCalledWith(true)
    expect(result).toEqual({ ok: true, enabled: true })
    cleanup()
  })

  it('returns null without api for auto-launch', async () => {
    expect(await applyAutoLaunch(true)).toBeNull()
  })

  it('fetches auto-launch status', async () => {
    const getAutoLaunch = vi.fn().mockResolvedValue({ ok: true, enabled: false })
    const cleanup = withApi({ getAutoLaunch })
    expect(await fetchAutoLaunchStatus()).toEqual({ ok: true, enabled: false })
    cleanup()
  })

  it('returns null when status fetch fails', async () => {
    const getAutoLaunch = vi.fn().mockRejectedValue(new Error('no'))
    const cleanup = withApi({ getAutoLaunch })
    expect(await fetchAutoLaunchStatus()).toBeNull()
    cleanup()
  })
})

  it('defaults autoCheckUpdate to enabled', () => {
    expect(DEFAULT_AUTO_CHECK_UPDATE).toBe(true)
    expect(readAutoCheckUpdate({})).toBe(true)
    expect(readAutoCheckUpdate({ autoCheckUpdate: false })).toBe(false)
  })

  it('syncs autoCheckUpdate through window.api', () => {
    const setAutoCheckUpdate = vi.fn()
    const cleanup = withApi({ setAutoCheckUpdate })
    expect(syncAutoCheckUpdate({ autoCheckUpdate: false })).toBe(true)
    expect(setAutoCheckUpdate).toHaveBeenCalledWith(false)
    cleanup()
  })

  it('returns false when autoCheckUpdate api is unavailable', () => {
    expect(syncAutoCheckUpdate({})).toBe(false)
  })
