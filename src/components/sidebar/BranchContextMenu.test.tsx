// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BranchDto, RemoteDto } from '../../lib/types'
import BranchContextMenu from './BranchContextMenu'

const remote: RemoteDto = { name: 'origin', url: 'git@example.com:demo/repo.git' }

function branch(overrides: Partial<BranchDto> = {}): BranchDto {
  return {
    name: 'feature/login',
    isRemote: false,
    isHead: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    oid: '0123456789012345678901234567890123456789',
    shortOid: '0123456',
    subject: 'feature',
    ...overrides
  }
}

function renderMenu(menu: Parameters<typeof BranchContextMenu>[0]['menu'], overrides = {}) {
  const props = {
    menu,
    remoteNames: ['origin'],
    currentBranch: 'main',
    currentUpstream: 'origin/main',
    operationState: 'clean',
    onDismiss: vi.fn(),
    onCreateFromRemote: vi.fn(),
    onCheckout: vi.fn(),
    onPull: vi.fn(),
    onPullRemote: vi.fn(),
    onMerge: vi.fn(),
    onRebase: vi.fn(),
    onSquash: vi.fn(),
    onCherryPick: vi.fn(),
    onReset: vi.fn(),
    onCreateTag: vi.fn(),
    onDeleteRemote: vi.fn(),
    onPush: vi.fn(),
    onSetUpstream: vi.fn(),
    onCancelUpstream: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  }
  render(<BranchContextMenu {...props} />)
  return props
}

afterEach(cleanup)

describe('BranchContextMenu', () => {
  it('opens remote branch creation with the selected source', () => {
    const selected = branch({ name: 'origin/main', isRemote: true })
    const props = renderMenu({ x: 0, y: 0, scope: 'remote', branch: selected, remote })
    fireEvent.click(screen.getByRole('button', { name: /创建本地分支/ }))
    expect(props.onCreateFromRemote).toHaveBeenCalledWith(selected, remote)
    expect(props.onDismiss).toHaveBeenCalled()
  })

  it('explains rebase direction and invokes the selected branch', () => {
    const selected = branch({ name: 'origin/main', isRemote: true })
    const props = renderMenu({ x: 0, y: 0, scope: 'remote', branch: selected, remote })
    expect(screen.getByText('将当前分支提交重放到此分支之后，会改写历史')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /变基当前分支到此分支/ }))
    expect(props.onRebase).toHaveBeenCalledWith(selected)
  })

  it('enables remote pull only when the current upstream matches exactly', () => {
    const selected = branch({ name: 'origin/main', isRemote: true })
    renderMenu({ x: 0, y: 0, scope: 'remote', branch: selected, remote })
    const pull = screen.getByRole('button', {
      name: /从该远程分支拉取当前分支/
    }) as HTMLButtonElement
    expect(pull.disabled).toBe(false)
  })

  it('disables remote pull with a reason when upstream does not match', () => {
    const selected = branch({ name: 'origin/feature/login', isRemote: true })
    renderMenu(
      { x: 0, y: 0, scope: 'remote', branch: selected, remote },
      { currentUpstream: 'origin/other' }
    )
    const pull = screen.getByRole('button', {
      name: /从该远程分支拉取当前分支/
    }) as HTMLButtonElement
    expect(pull.disabled).toBe(true)
    expect(pull.title).toBe('当前分支未追踪 origin/feature/login')
  })

  it('disables integration operations while another operation is active', () => {
    const selected = branch({ name: 'origin/main', isRemote: true })
    renderMenu(
      { x: 0, y: 0, scope: 'remote', branch: selected, remote },
      { operationState: 'rebase' }
    )
    const merge = screen.getByRole('button', {
      name: /^合并到当前分支/
    }) as HTMLButtonElement
    expect(merge.disabled).toBe(true)
    expect(merge.title).toContain('rebase')
  })

  it('disables integration into the same current branch', () => {
    const selected = branch({ name: 'main', isHead: true })
    renderMenu({ x: 0, y: 0, scope: 'local', branch: selected })
    const reset = screen.getByRole('button', {
      name: /重置当前分支到此分支/
    }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(reset.title).toBe('当前分支已经是此分支')
  })

  it('disables branch integration in detached HEAD', () => {
    const selected = branch({ name: 'origin/main', isRemote: true })
    renderMenu(
      { x: 0, y: 0, scope: 'remote', branch: selected, remote },
      { currentBranch: null, currentUpstream: null }
    )
    const merge = screen.getByRole('button', {
      name: /^合并到当前分支/
    }) as HTMLButtonElement
    expect(merge.disabled).toBe(true)
    expect(merge.title).toBe('当前处于分离头指针，请先检出本地分支')
  })

  it('disables local pull when the branch has no upstream', () => {
    renderMenu({ x: 0, y: 0, scope: 'local', branch: branch() })
    const pull = screen.getByRole('button', {
      name: /拉取对应远程分支/
    }) as HTMLButtonElement
    expect(pull.disabled).toBe(true)
    expect(pull.title).toBe('该分支没有追踪上游')
  })

  it('passes the resolved tracking branch to pull', () => {
    const selected = branch({ upstream: 'origin/feature/login' })
    const props = renderMenu({ x: 0, y: 0, scope: 'local', branch: selected })
    fireEvent.click(screen.getByRole('button', { name: /拉取对应远程分支/ }))
    expect(props.onPull).toHaveBeenCalledWith(selected, {
      remote: 'origin',
      branch: 'feature/login'
    })
  })

  it('opens tag creation with the selected branch', () => {
    const selected = branch({ name: 'origin/release', isRemote: true })
    const props = renderMenu({ x: 0, y: 0, scope: 'remote', branch: selected, remote })
    fireEvent.click(screen.getByRole('button', { name: /创建标签/ }))
    expect(props.onCreateTag).toHaveBeenCalledWith(selected)
  })

  it('confirms deleting the selected remote branch', () => {
    const selected = branch({ name: 'origin/feature/login', isRemote: true })
    const props = renderMenu({ x: 0, y: 0, scope: 'remote', branch: selected, remote })
    fireEvent.click(screen.getByRole('button', { name: /删除远程分支/ }))
    expect(props.onDeleteRemote).toHaveBeenCalledWith(selected, remote)
  })
})
