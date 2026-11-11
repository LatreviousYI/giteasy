// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FileStatusTree from './FileStatusTree'
import type { FileStatus } from '../../lib/types'

const files: FileStatus[] = [
  {
    path: 'docs/draft.md',
    oldPath: null,
    index: 'unmodified',
    worktree: 'untracked',
    staged: false,
    unstaged: true,
    conflicted: false
  },
  {
    path: 'src/app.ts',
    oldPath: null,
    index: 'unmodified',
    worktree: 'modified',
    staged: false,
    unstaged: true,
    conflicted: false
  }
]

describe('FileStatusTree', () => {
  it('collapses directories and stages all files below a directory', () => {
    const onStage = vi.fn()
    render(
      <FileStatusTree
        title="未暂存"
        files={files}
        groupStaged={false}
        actionLabel="全部暂存"
        selectedFile={null}
        selectedStaged={false}
        busy={false}
        onSelect={vi.fn()}
        onStage={onStage}
        onDiscard={vi.fn()}
        onResolveConflict={vi.fn()}
      />
    )

    expect(screen.getByText('draft.md')).toBeTruthy()
    fireEvent.click(screen.getByText('docs'))
    expect(screen.queryByText('draft.md')).toBeNull()
    fireEvent.click(screen.getAllByTitle('暂存此目录')[0])
    expect(onStage).toHaveBeenCalledWith(['docs/draft.md'], true)
  })
})
