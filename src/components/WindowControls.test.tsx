// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const { getCurrentWindow } = vi.hoisted(() => ({
  getCurrentWindow: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow }))

describe('WindowControls', () => {
  const minimize = vi.fn().mockResolvedValue(undefined)
  const toggleMaximize = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn().mockResolvedValue(undefined)
  const isMaximized = vi.fn().mockResolvedValue(false)
  const onResized = vi.fn().mockResolvedValue(() => undefined)

  beforeEach(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })
    getCurrentWindow.mockReturnValue({
      close,
      isMaximized,
      minimize,
      onResized,
      toggleMaximize
    })
    vi.resetModules()
  })

  afterEach(() => {
    cleanup()
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('controls the current Tauri window', async () => {
    const { default: WindowControls } = await import('./WindowControls')
    render(<WindowControls />)

    await waitFor(() => expect(isMaximized).toHaveBeenCalled())

    screen.getByRole('button', { name: '最小化' }).click()
    screen.getByRole('button', { name: '最大化' }).click()
    screen.getByRole('button', { name: '关闭' }).click()

    expect(minimize).toHaveBeenCalledOnce()
    expect(toggleMaximize).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
