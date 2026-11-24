// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommitDto } from '../../lib/types'
import CommitContextMenu from './CommitContextMenu'

const commit: CommitDto = {
  oid: '1111111111111111111111111111111111111111',
  shortOid: '1111111',
  parents: ['0000000000000000000000000000000000000000'],
  authorName: 'Demo User',
  authorEmail: 'demo@example.com',
  time: 1_700_000_000,
  subject: 'feat: commit menu',
  body: '',
  refs: []
}

function renderMenu(overrides = {}, selected = commit) {
  const props = {
    menu: { x: 20, y: 20, commit: selected },
    currentBranch: 'main',
    operationState: 'clean',
    ancestor: true,
    ancestorLoading: false,
    busy: false,
    onDismiss: vi.fn(),
    onCherryPick: vi.fn(),
    onRevert: vi.fn(),
    onReset: vi.fn(),
    onRebase: vi.fn(),
    onCreateBranch: vi.fn(),
    onCreateTag: vi.fn(),
    onCheckout: vi.fn(),
    onCopy: vi.fn(),
    ...overrides
  }
  render(<CommitContextMenu {...props} />)
  return props
}

afterEach(cleanup)

describe('CommitContextMenu', () => {
  it('shows every commit action and invokes the selected callback', () => {
    const props = renderMenu()
    expect(screen.getByText(/feat: commit menu/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cherry-pick 到当前分支/ }))
    expect(props.onCherryPick).toHaveBeenCalledWith(commit)
    expect(props.onDismiss).toHaveBeenCalled()
  })

  it('disables cherry-pick and revert for merge commits', () => {
    const mergeCommit = {
      ...commit,
      parents: ['0000000000000000000000000000000000000000', commit.oid]
    }
    renderMenu({}, mergeCommit)
    expect(
      (screen.getByRole('button', { name: /Cherry-pick 到当前分支/ }) as HTMLButtonElement).disabled
    ).toBe(true)
    const cherryPick = screen.getByRole('button', {
      name: /Cherry-pick 到当前分支/
    }) as HTMLButtonElement
    const revert = screen.getByRole('button', {
      name: /^回滚此提交/
    }) as HTMLButtonElement
    expect(cherryPick.title).toContain('mainline')
    expect(revert.disabled).toBe(true)
    expect(revert.title).toContain('mainline')
  })

  it('disables revert for a commit outside the current branch history', () => {
    renderMenu({ ancestor: false })
    const revert = screen.getByRole('button', { name: /^回滚此提交/ }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    expect(revert.title).toContain('改用 Cherry-pick')
  })

  it('keeps non-branch actions available in detached HEAD', () => {
    const props = renderMenu({ currentBranch: null })
    expect(
      (screen.getByRole('button', { name: /Cherry-pick 到当前分支/ }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /创建并检出分支/ }))
    expect(props.onCreateBranch).toHaveBeenCalledWith(commit)
  })
})
