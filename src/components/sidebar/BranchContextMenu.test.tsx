// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BranchDto, RemoteDto } from '../../lib/types'
import BranchContextMenu from './BranchContextMenu'

const remote: RemoteDto = { name: 'origin', url: 'git@example.com:demo/repo.git' }

function localBranch(overrides: Partial<BranchDto> = {}): BranchDto {
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
    onDismiss: vi.fn(),
    onCreateFromRemote: vi.fn(),
    onCheckout: vi.fn(),
    onPull: vi.fn(),
    onMerge: vi.fn(),
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
    const branch = localBranch({ name: 'origin/main', isRemote: true })
    const props = renderMenu({ x: 0, y: 0, scope: 'remote', branch, remote })
    fireEvent.click(screen.getByRole('button', { name: '创建本地分支…' }))
    expect(props.onCreateFromRemote).toHaveBeenCalledWith(branch, remote)
    expect(props.onDismiss).toHaveBeenCalled()
  })

  it('disables pull when the local branch has no upstream', () => {
    renderMenu({ x: 0, y: 0, scope: 'local', branch: localBranch() })
    const pull = screen.getByRole('button', {
      name: '拉取对应远程分支（无追踪上游）'
    }) as HTMLButtonElement
    expect(pull.disabled).toBe(true)
    expect(pull.title).toBe('该分支没有追踪上游')
  })

  it('passes the resolved tracking branch to pull', () => {
    const branch = localBranch({ upstream: 'origin/feature/login' })
    const props = renderMenu({ x: 0, y: 0, scope: 'local', branch })
    fireEvent.click(screen.getByRole('button', { name: '拉取对应远程分支' }))
    expect(props.onPull).toHaveBeenCalledWith(branch, {
      remote: 'origin',
      branch: 'feature/login'
    })
  })
})
