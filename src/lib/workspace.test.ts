import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPersistedWorkspace, savePersistedWorkspace } from './workspace'
import { createRepoViewState } from '../store/repoState'

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  }
  vi.stubGlobal('window', { localStorage: storage })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('workspace persistence', () => {
  it('round-trips tabs, active repo and per-repo views', () => {
    installStorage()
    savePersistedWorkspace({
      tabs: ['/tmp/repo-a', '/tmp/repo-b'],
      activeRepoId: '/tmp/repo-b',
      views: {
        '/tmp/repo-a': { ...createRepoViewState(), view: 'history' },
        '/tmp/repo-b': { ...createRepoViewState(), view: 'conflicts' }
      }
    })

    const restored = loadPersistedWorkspace()
    expect(restored?.tabs).toEqual(['/tmp/repo-a', '/tmp/repo-b'])
    expect(restored?.activeRepoId).toBe('/tmp/repo-b')
    expect(restored?.views['/tmp/repo-a'].view).toBe('history')
    expect(restored?.views['/tmp/repo-b'].view).toBe('conflicts')
  })

  it('ignores invalid persisted data', () => {
    installStorage({ 'giteasy.workspace.v1': '{invalid' })
    expect(loadPersistedWorkspace()).toBeNull()
  })
})
