// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FileStatus } from '../../lib/types'
import { useApp } from '../../store/app'
import StashCreateDialog from './StashCreateDialog'

const { stashSave } = vi.hoisted(() => ({
  stashSave: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../lib/ipc', () => ({
  ipc: { stashSave }
}))

const files: FileStatus[] = [
  {
    path: 'hello.txt',
    oldPath: null,
    index: 'modified',
    worktree: 'modified',
    staged: false,
    unstaged: true,
    conflicted: false
  },
  {
    path: 'new.txt',
    oldPath: null,
    index: 'unmodified',
    worktree: 'untracked',
    staged: false,
    unstaged: true,
    conflicted: false
  }
]

describe('StashCreateDialog', () => {
  afterEach(cleanup)

  beforeEach(() => {
    stashSave.mockClear()
    useApp.setState({ toasts: [] })
  })

  it('stashes only checked files and detects untracked selection', async () => {
    const onClose = vi.fn()
    const onChanged = vi.fn()
    render(
      <StashCreateDialog
        repoPath="/tmp/repo"
        files={files}
        onClose={onClose}
        onChanged={onChanged}
      />
    )

    fireEvent.click(screen.getByLabelText(/hello.txt/))
    fireEvent.click(screen.getByRole('button', { name: '创建储藏' }))

    await waitFor(() => {
      expect(stashSave).toHaveBeenCalledWith(
        '/tmp/repo',
        null,
        true,
        ['new.txt']
      )
    })
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('disables conflicted files and prevents an empty stash', () => {
    render(
      <StashCreateDialog
        repoPath="/tmp/repo"
        files={[
          ...files,
          {
            path: 'conflict.txt',
            oldPath: null,
            index: 'unmerged',
            worktree: 'unmerged',
            staged: false,
            unstaged: true,
            conflicted: true
          }
        ]}
        onClose={() => undefined}
        onChanged={() => undefined}
      />
    )

    expect((screen.getByLabelText(/conflict.txt/) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '全不选' }))
    expect(
      (screen.getByRole('button', { name: '创建储藏' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
