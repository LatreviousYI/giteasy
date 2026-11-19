// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApp } from '../store/app'
import { closeOperationCount, useCloseRequest } from './useCloseRequest'

const { listen, appExit } = vi.hoisted(() => ({
  listen: vi.fn(),
  appExit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/api/event', () => ({ listen }))
vi.mock('./ipc', () => ({ ipc: { appExit } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  listen.mockResolvedValue(() => undefined)
  useApp.setState({ errorToast: vi.fn(), toasts: [] })
})

describe('useCloseRequest', () => {
  it('normalizes missing and invalid operation counts', () => {
    expect(closeOperationCount({ operations: 2 })).toBe(2)
    expect(closeOperationCount({ operations: 0 })).toBe(1)
    expect(closeOperationCount(null)).toBe(1)
    expect(closeOperationCount({ operations: Number.NaN })).toBe(1)
  })

  it('shows a prompt from the backend close event and cancels it', async () => {
    const { result } = renderHook(() => useCloseRequest(true))
    await waitFor(() => expect(listen).toHaveBeenCalled())

    const handler = listen.mock.calls[0][1] as (event: { payload: { operations: number } }) => void
    act(() => handler({ payload: { operations: 3 } }))
    expect(result.current.operations).toBe(3)

    act(() => result.current.cancel())
    expect(result.current.operations).toBeNull()
    expect(appExit).not.toHaveBeenCalled()
  })

  it('confirms by invoking the backend exit command', async () => {
    const { result } = renderHook(() => useCloseRequest(true))
    await waitFor(() => expect(listen).toHaveBeenCalled())

    const handler = listen.mock.calls[0][1] as (event: { payload: { operations: number } }) => void
    act(() => handler({ payload: { operations: 1 } }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(appExit).toHaveBeenCalledOnce()
    expect(result.current.closing).toBe(true)
  })

  it('does not subscribe when disabled', () => {
    renderHook(() => useCloseRequest(false))
    expect(listen).not.toHaveBeenCalled()
  })
})
