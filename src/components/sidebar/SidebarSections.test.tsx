// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BranchDto } from '../../lib/types'
import { BranchSection, RemoteSection, buildBranchTree } from './SidebarSections'

function branch(name: string, isHead = false): BranchDto {
  return {
    name,
    isRemote: false,
    isHead,
    upstream: null,
    ahead: 0,
    behind: 0,
    oid: '0123456789012345678901234567890123456789',
    shortOid: '0123456',
    subject: name
  }
}

describe('branch tree', () => {
  afterEach(cleanup)

  it('groups slash-separated names into nested directories', () => {
    const tree = buildBranchTree([
      { branch: branch('feature/ui'), name: 'feature/ui' },
      { branch: branch('feature/auth/login'), name: 'feature/auth/login' },
      { branch: branch('main', true), name: 'main' }
    ])

    expect(tree.map((node) => node.name)).toEqual(['feature', 'main'])
    expect(tree[0].directories.map((node) => node.name)).toEqual(['auth', 'ui'])
    expect(tree[0].directories[0].directories[0].branch?.name).toBe('feature/auth/login')
  })

  it('collapses and restores a branch directory', () => {
    render(
      <BranchSection
        branches={[branch('main', true), branch('feature/ui'), branch('feature/auth')]}
        picked={null}
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onCheckout={vi.fn()}
        onContextMenu={vi.fn()}
      />
    )

    expect(screen.getByText('ui')).toBeTruthy()
    fireEvent.click(screen.getByTitle('折叠分支目录 feature'))
    expect(screen.queryByText('ui')).toBeNull()
    fireEvent.click(screen.getByTitle('展开分支目录 feature'))
    expect(screen.getByText('ui')).toBeTruthy()
  })

  it('indents remote branches below their remote parent', () => {
    const remoteBranch = (name: string): BranchDto => ({
      ...branch(name),
      isRemote: true,
      isHead: false
    })

    render(
      <RemoteSection
        remotes={[{ name: 'origin', url: 'git@example.com:demo/repo.git' }]}
        branches={[remoteBranch('origin/main'), remoteBranch('origin/feature/ui')]}
        picked={null}
        collapsed={{}}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onPick={vi.fn()}
        onCheckout={vi.fn()}
        onContextMenu={vi.fn()}
        onWorktree={vi.fn()}
        onDeleteRemote={vi.fn()}
        onDeleteBranch={vi.fn()}
      />
    )

    const mainRow = screen.getByText('main').closest('.list-row') as HTMLElement
    const featureRow = screen.getByText('feature').closest('.list-row') as HTMLElement
    const uiRow = screen.getByText('ui').closest('.list-row') as HTMLElement

    expect(mainRow.style.paddingLeft).toBe('26px')
    expect(featureRow.style.paddingLeft).toBe('26px')
    expect(uiRow.style.paddingLeft).toBe('40px')
  })

  it('passes the selected branch to the single-click handler', () => {
    const onPick = vi.fn()
    render(
      <BranchSection
        branches={[branch('main', true), branch('feature/history')]}
        picked={null}
        onPick={onPick}
        onCreate={vi.fn()}
        onCheckout={vi.fn()}
        onContextMenu={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('history'))

    expect(onPick).toHaveBeenCalledWith(
      'local:feature/history',
      expect.objectContaining({ name: 'feature/history' })
    )
  })

  it('passes a remote branch to the context-menu handler', () => {
    const onContextMenu = vi.fn()
    const remoteBranch = (name: string): BranchDto => ({
      ...branch(name),
      isRemote: true,
      isHead: false
    })

    render(
      <RemoteSection
        remotes={[{ name: 'origin', url: 'git@example.com:demo/repo.git' }]}
        branches={[remoteBranch('origin/feature/context')]}
        picked={null}
        collapsed={{}}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onPick={vi.fn()}
        onCheckout={vi.fn()}
        onContextMenu={onContextMenu}
        onWorktree={vi.fn()}
        onDeleteRemote={vi.fn()}
        onDeleteBranch={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByText('context'))
    expect(onContextMenu).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ name: 'origin/feature/context' }),
      expect.objectContaining({ name: 'origin' })
    )
  })

  it('passes the full nested remote branch name to delete', () => {
    const onDeleteBranch = vi.fn()
    const remoteBranch: BranchDto = {
      ...branch('origin/feature/login'),
      isRemote: true,
      isHead: false
    }

    render(
      <RemoteSection
        remotes={[{ name: 'origin', url: 'git@example.com:demo/repo.git' }]}
        branches={[remoteBranch]}
        picked={null}
        collapsed={{}}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onPick={vi.fn()}
        onCheckout={vi.fn()}
        onContextMenu={vi.fn()}
        onWorktree={vi.fn()}
        onDeleteRemote={vi.fn()}
        onDeleteBranch={onDeleteBranch}
      />
    )

    fireEvent.click(screen.getByTitle('删除远程分支'))
    expect(onDeleteBranch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'origin' }),
      remoteBranch,
      'feature/login'
    )
  })
})
