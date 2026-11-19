// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipc } from './ipc'
import { useAutoFetch } from './useAutoFetch'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.useFakeTimers()
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })
}

describe('useAutoFetch', () => {
  it('does not fetch when disabled', () => {
    const fetch = vi.spyOn(ipc, 'fetch').mockResolvedValue(undefined)
    renderHook(() => useAutoFetch('/repo', 0, createQueryClient()))
    vi.advanceTimersByTime(3_600_000)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the current repository after the configured interval', async () => {
    const fetch = vi.spyOn(ipc, 'fetch').mockResolvedValue(undefined)
    renderHook(() => useAutoFetch('/repo/current', 60, createQueryClient()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59 * 60_000)
    })
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetch).toHaveBeenCalledWith('/repo/current', null, expect.any(Function))
  })

  it('waits for a slow fetch before scheduling the next one', async () => {
    let resolveFetch: (() => void) | undefined
    const fetch = vi.spyOn(ipc, 'fetch').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = resolve
        })
    )
    renderHook(() => useAutoFetch('/repo', 60, createQueryClient()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60_000)
    })
    expect(fetch).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60_000)
    })
    expect(fetch).toHaveBeenCalledOnce()

    await act(async () => {
      resolveFetch?.()
      await Promise.resolve()
    })
  })
})
