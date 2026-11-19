// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BranchDto } from '../../lib/types'
import DeleteLocalBranchDialog from './DeleteLocalBranchDialog'

const branch: BranchDto = {
  name: 'feature/login',
  isRemote: false,
  isHead: false,
  upstream: 'origin/feature/login',
  ahead: 0,
  behind: 0,
  oid: '0123456789012345678901234567890123456789',
  shortOid: '0123456',
  subject: 'feature'
}

afterEach(cleanup)

describe('DeleteLocalBranchDialog', () => {
  it('keeps remote deletion disabled by default', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteLocalBranchDialog
        branch={branch}
        tracked={{ remote: 'origin', branch: 'feature/login' }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    expect((screen.getByLabelText('同时删除对应的远程追踪分支') as HTMLInputElement).checked).toBe(
      false
    )
    fireEvent.click(screen.getByRole('button', { name: '删除本地分支' }))
    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('passes the explicit remote deletion choice', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteLocalBranchDialog
        branch={branch}
        tracked={{ remote: 'origin', branch: 'feature/login' }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByLabelText('同时删除对应的远程追踪分支'))
    expect(screen.getByText(/无法通过本地操作恢复/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除本地和远程' }))
    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('hides the remote option when there is no tracked upstream', () => {
    render(
      <DeleteLocalBranchDialog
        branch={{ ...branch, upstream: null }}
        tracked={null}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('同时删除对应的远程追踪分支')).toBeNull()
  })
})
