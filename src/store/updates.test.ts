// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { check } from '@tauri-apps/plugin-updater'
import { useUpdates } from './updates'

const { updateContext, openUpdatePage } = vi.hoisted(() => ({
  updateContext: vi.fn(),
  openUpdatePage: vi.fn()
}))

vi.mock('../lib/ipc', () => ({
  ipc: { updateContext, openUpdatePage }
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn()
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn()
}))

const checkMock = vi.mocked(check)

describe('update store', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key)
      }
    })
    updateContext.mockReset().mockResolvedValue({
      currentVersion: '0.1.1',
      installKind: 'portable',
      canInstallInPlace: false,
      executable: '/tmp/giteasy'
    })
    openUpdatePage.mockReset().mockResolvedValue(undefined)
    checkMock.mockReset()
    useUpdates.setState({
      status: 'idle',
      context: null,
      availableVersion: null,
      notes: null,
      publishedAt: null,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      pendingUpdate: null
    })
  })

  it('checks the packaged version in browser mock mode', async () => {
    await useUpdates.getState().check(true)

    expect(updateContext).toHaveBeenCalled()
    expect(useUpdates.getState().status).toBe('up-to-date')
    expect(useUpdates.getState().context?.currentVersion).toBe('0.1.1')
    expect(window.localStorage.getItem('giteasy.updates.lastCheck')).toBeTruthy()
  })

  it('opens the release page for non-in-place installations', async () => {
    await useUpdates.getState().openDownloadPage()
    expect(openUpdatePage).toHaveBeenCalled()
  })

  it('initializes the version context when the network check is throttled', async () => {
    await useUpdates.getState().check(true)
    useUpdates.setState({ status: 'idle', context: null })

    await useUpdates.getState().check()

    expect(updateContext).toHaveBeenCalledTimes(2)
    expect(useUpdates.getState().status).toBe('up-to-date')
    expect(useUpdates.getState().context?.currentVersion).toBe('0.1.1')
  })

  it('does not apply the check interval when an update is available', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })
    checkMock.mockResolvedValue({
      version: '0.1.2',
      body: 'Release notes',
      date: '2026-11-16T00:00:00Z',
      close: vi.fn().mockResolvedValue(undefined)
    } as never)

    try {
      vi.resetModules()
      const { useUpdates: tauriUpdates } = await import('./updates')
      await tauriUpdates.getState().check(true)

      expect(tauriUpdates.getState().status).toBe('available')
      expect(tauriUpdates.getState().availableVersion).toBe('0.1.2')
      expect(window.localStorage.getItem('giteasy.updates.lastCheck')).toBeNull()
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
      vi.resetModules()
    }
  })
})
