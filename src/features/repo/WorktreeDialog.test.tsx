// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { BranchDto, RepoInfo } from '../../lib/types'
import { useApp } from '../../store/app'
import WorktreeDialog from './WorktreeDialog'

const { worktreeAdd, pickDirectory } = vi.hoisted(() => ({
  worktreeAdd: vi.fn().mockResolvedValue(undefined),
  pickDirectory: vi.fn().mockResolvedValue('/tmp/worktrees')
}))

vi.mock('../../lib/ipc', () => ({
  ipc: { worktreeAdd }
}))

vi.mock('../../lib/actions', () => ({
  pickDirectory
}))

const repo: RepoInfo = {
  path: '/tmp/repo',
  name: 'repo',
  branch: 'main',
  headOid: '0123456789012345678901234567890123456789',
  headShort: '0123456',
  detached: false,
  bare: false,
  remoteUrl: null,
  state: 'clean'
}

function branch(name: string, isRemote: boolean, isHead = false): BranchDto {
  return {
    name,
    isRemote,
    isHead,
    upstream: null,
    ahead: 0,
    behind: 0,
    oid: '0123456789012345678901234567890123456789',
    shortOid: '0123456',
    subject: name
  }
}

const branches = [
  branch('main', false, true),
  branch('dev', false),
  branch('origin/feature/ui', true)
]

describe('WorktreeDialog', () => {
  afterEach(cleanup)

  beforeEach(() => {
    worktreeAdd.mockClear()
    pickDirectory.mockClear()
    useApp.setState({ repo, toasts: [] })
  })

  it('creates a new branch from a selected remote branch', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(
      <WorktreeDialog
        initialBranch={branches[2]}
        branches={branches}
        onClose={onClose}
        onCreated={onCreated}
      />
    )

    expect(screen.getByDisplayValue('feature/ui')).toBeTruthy()
    expect(screen.getByDisplayValue('origin/feature/ui')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '选择父目录…' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue('/tmp/worktrees/ui')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '创建 Worktree' }))

    await waitFor(() => {
      expect(worktreeAdd).toHaveBeenCalledWith(
        '/tmp/repo',
        '/tmp/worktrees/ui',
        'feature/ui',
        true,
        'origin/feature/ui'
      )
    })
    expect(onCreated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('can attach an existing local branch', async () => {
    render(
      <WorktreeDialog
        branches={branches}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText('使用已有本地分支'))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'dev' }
    })
    fireEvent.click(screen.getByRole('button', { name: '选择父目录…' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue('/tmp/worktrees/dev')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '创建 Worktree' }))

    await waitFor(() => {
      expect(worktreeAdd).toHaveBeenCalledWith(
        '/tmp/repo',
        '/tmp/worktrees/dev',
        'dev',
        false,
        null
      )
    })
  })
})
