import { beforeEach, describe, expect, it } from 'vitest'
import type { RepoInfo } from '../lib/types'
import { useApp } from './app'
import { createRepoViewState } from './repoState'

function repo(path: string, name: string): RepoInfo {
  return {
    path,
    name,
    branch: 'main',
    headOid: '0123456789012345678901234567890123456789',
    headShort: '0123456',
    detached: false,
    bare: false,
    remoteUrl: null,
    state: 'clean'
  }
}

describe('per-repository UI state', () => {
  beforeEach(() => {
    useApp.setState({
      repo: null,
      repos: {},
      repoStates: {},
      workspaceTabs: [],
      activeRepoId: null,
      ...createRepoViewState()
    })
  })

  it('restores view state when switching back to a repository', () => {
    const first = repo('/tmp/repo-a', 'repo-a')
    const second = repo('/tmp/repo-b', 'repo-b')
    const state = useApp.getState()

    state.setRepo(first)
    useApp.getState().setView('history')
    useApp.getState().selectFile('src/a.ts', true)
    useApp.getState().selectCommit('commit-a')

    state.setRepo(second)
    expect(useApp.getState().view).toBe('changes')
    useApp.getState().setView('conflicts')
    useApp.getState().selectFile('src/b.ts')

    state.setRepo(first)
    expect(useApp.getState().view).toBe('history')
    expect(useApp.getState().selectedFile).toBe('src/a.ts')
    expect(useApp.getState().selectedFileStaged).toBe(true)
    expect(useApp.getState().selectedCommit).toBe('commit-a')

    state.setRepo(second)
    expect(useApp.getState().view).toBe('conflicts')
    expect(useApp.getState().selectedFile).toBe('src/b.ts')
  })

  it('clears repo state after closing its workspace tab', () => {
    const info = repo('/tmp/repo-a', 'repo-a')
    const state = useApp.getState()

    state.setRepo(info)
    useApp.getState().setView('history')
    useApp.getState().selectFile('src/a.ts')
    state.setRepo(null)
    state.setRepo(info)

    expect(useApp.getState().view).toBe('changes')
    expect(useApp.getState().selectedFile).toBeNull()
  })

  it('opens, activates, reorders and closes workspace tabs', () => {
    const first = repo('/tmp/repo-a', 'repo-a')
    const second = repo('/tmp/repo-b', 'repo-b')
    const third = repo('/tmp/repo-c', 'repo-c')
    const state = useApp.getState()

    state.openRepoWorkspace(first)
    state.openRepoWorkspace(second)
    state.openRepoWorkspace(third)
    expect(useApp.getState().workspaceTabs).toEqual([
      '/tmp/repo-a',
      '/tmp/repo-b',
      '/tmp/repo-c'
    ])
    expect(useApp.getState().activeRepoId).toBe('/tmp/repo-c')

    state.reorderRepoWorkspace(2, 0)
    expect(useApp.getState().workspaceTabs).toEqual([
      '/tmp/repo-c',
      '/tmp/repo-a',
      '/tmp/repo-b'
    ])

    state.activateRepoWorkspace('/tmp/repo-b')
    expect(useApp.getState().activeRepoId).toBe('/tmp/repo-b')
    state.closeRepoWorkspace('/tmp/repo-b')
    expect(useApp.getState().workspaceTabs).toEqual(['/tmp/repo-c', '/tmp/repo-a'])
    expect(useApp.getState().activeRepoId).toBe('/tmp/repo-a')
    expect(useApp.getState().persistedWorkspace()).toEqual({
      tabs: ['/tmp/repo-c', '/tmp/repo-a'],
      activeRepoId: '/tmp/repo-a',
      views: {
        '/tmp/repo-c': expect.objectContaining({ view: 'changes' }),
        '/tmp/repo-a': expect.objectContaining({ view: 'changes' })
      }
    })
  })
})
