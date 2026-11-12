// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RepoInfo } from '../../lib/types'
import { useApp } from '../../store/app'
import { createRepoViewState } from '../../store/repoState'
import PullStrategyDialog from './PullStrategyDialog'

const { runRemote } = vi.hoisted(() => ({
  runRemote: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../lib/remote', () => ({
  useRemoteActions: () => ({ runRemote })
}))

const repo: RepoInfo = {
  path: '/tmp/repo-a',
  name: 'repo-a',
  branch: 'main',
  headOid: '0123456789012345678901234567890123456789',
  headShort: '0123456',
  detached: false,
  bare: false,
  remoteUrl: 'git@example.com:demo/repo-a.git',
  state: 'clean'
}

describe('PullStrategyDialog', () => {
  beforeEach(() => {
    runRemote.mockClear()
    useApp.setState({
      repo,
      repos: { [repo.path]: repo },
      repoStates: { [repo.path]: createRepoViewState() },
      workspaceTabs: [repo.path],
      activeRepoId: repo.path,
      ...createRepoViewState(),
      pullPrompt: {
        repoPath: repo.path,
        remoteName: 'origin',
        branch: 'main',
        ahead: 1,
        behind: 2
      }
    })
  })

  it('runs the selected strategy and remembers it for the repository', async () => {
    render(<PullStrategyDialog />)

    fireEvent.click(screen.getByLabelText(/把本地提交变基到远端/))
    fireEvent.click(screen.getByLabelText(/记住此仓库的选择/))
    fireEvent.click(screen.getByRole('button', { name: '开始拉取' }))

    await waitFor(() => {
      expect(runRemote).toHaveBeenCalledWith('pull', false, 'origin', 'rebase')
    })
    expect(useApp.getState().pullPrompt).toBeNull()
    expect(useApp.getState().pullStrategy).toBe('rebase')
    expect(useApp.getState().repoStates[repo.path].pullStrategy).toBe('rebase')
  })
})
