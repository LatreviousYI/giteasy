import { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { ipc } from './ipc'
import { useApp } from '../store/app'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function closeOperationCount(payload: unknown): number {
  const raw =
    typeof payload === 'object' && payload !== null
      ? (payload as { operations?: unknown }).operations
      : 1
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 1
  return Math.max(1, value)
}

export function useCloseRequest(enabled = isTauri) {
  const errorToast = useApp((state) => state.errorToast)
  const [operations, setOperations] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let unlisten: (() => void) | undefined
    listen<{ operations?: number }>('app://close-requested', (event) => {
      setOperations(closeOperationCount(event.payload))
    })
      .then((dispose) => {
        if (disposed) dispose()
        else unlisten = dispose
      })
      .catch(errorToast)
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [enabled, errorToast])

  const cancel = useCallback(() => {
    if (!closing) setOperations(null)
  }, [closing])

  const confirm = useCallback(async () => {
    if (closing || operations === null) return
    setClosing(true)
    try {
      await ipc.appExit()
    } catch (error) {
      setClosing(false)
      setOperations(null)
      errorToast(error)
    }
  }, [closing, operations, errorToast])

  return {
    operations,
    closing,
    cancel,
    confirm
  }
}
