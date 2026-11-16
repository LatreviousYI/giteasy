import { describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { invalidateRepoQueries, REPO_QUERY_DOMAINS } from './queries'

function queryClient() {
  return {
    invalidateQueries: vi.fn()
  } as unknown as QueryClient
}

describe('invalidateRepoQueries', () => {
  it('invalidates every registered repo query domain for the path', () => {
    const client = queryClient()

    invalidateRepoQueries(client, '/tmp/repo')

    expect(client.invalidateQueries).toHaveBeenCalledTimes(REPO_QUERY_DOMAINS.length)
    for (const domain of REPO_QUERY_DOMAINS) {
      expect(client.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [domain, '/tmp/repo']
      })
    }
  })

  it('supports targeted invalidation and ignores a missing repository', () => {
    const client = queryClient()

    invalidateRepoQueries(client, '/tmp/repo', ['status', 'log'])
    invalidateRepoQueries(client, null)

    expect(client.invalidateQueries).toHaveBeenCalledTimes(2)
    expect(client.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['status', '/tmp/repo']
    })
    expect(client.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['log', '/tmp/repo']
    })
  })
})
