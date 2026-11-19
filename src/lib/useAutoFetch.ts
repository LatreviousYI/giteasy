import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { ipc } from './ipc'
import { invalidateRepoQueries } from './queries'

export function useAutoFetch(
  repoPath: string | null,
  minutes: number,
  queryClient: QueryClient
): void {
  useEffect(() => {
    if (!repoPath || minutes <= 0) return
    let cancelled = false
    let timer: number

    const schedule = () => {
      timer = window.setTimeout(run, minutes * 60_000)
    }
    const run = async () => {
      try {
        await ipc.fetch(repoPath, null, () => undefined)
        if (!cancelled) {
          invalidateRepoQueries(queryClient, repoPath, ['status', 'log', 'branches'])
        }
      } catch {
        // Automatic fetch is best-effort; manual remote actions still surface errors.
      } finally {
        if (!cancelled) schedule()
      }
    }

    schedule()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [repoPath, minutes, queryClient])
}
