// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BranchDto } from '../../lib/types'
import { BranchSection, buildBranchTree } from './SidebarSections'

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
  it('groups slash-separated names into nested directories', () => {
    const tree = buildBranchTree([
      { branch: branch('feature/ui'), name: 'feature/ui' },
      { branch: branch('feature/auth/login'), name: 'feature/auth/login' },
      { branch: branch('main', true), name: 'main' }
    ])

    expect(tree.map((node) => node.name)).toEqual(['feature', 'main'])
    expect(tree[0].directories.map((node) => node.name)).toEqual(['auth', 'ui'])
    expect(tree[0].directories[0].directories[0].branch?.name).toBe(
      'feature/auth/login'
    )
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
})
