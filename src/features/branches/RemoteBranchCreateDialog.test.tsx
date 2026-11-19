// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BranchDto, RemoteDto } from '../../lib/types'
import RemoteBranchCreateDialog from './RemoteBranchCreateDialog'

const remote: RemoteDto = { name: 'origin', url: 'git@example.com:demo/repo.git' }
const branch: BranchDto = {
  name: 'origin/feature/login',
  isRemote: true,
  isHead: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  oid: '0123456789012345678901234567890123456789',
  shortOid: '0123456',
  subject: 'feature'
}

afterEach(cleanup)

describe('RemoteBranchCreateDialog', () => {
  it('uses the remote branch name without prefix and checks out by default', () => {
    const onSubmit = vi.fn()
    render(
      <RemoteBranchCreateDialog
        branch={branch}
        remote={remote}
        existingLocalNames={[]}
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    const input = screen.getByLabelText('本地分支名称') as HTMLInputElement
    expect(input.value).toBe('feature/login')
    expect((screen.getByLabelText('创建成功后切换到该分支') as HTMLInputElement).checked).toBe(true)

    fireEvent.change(input, { target: { value: 'feature/renamed' } })
    fireEvent.click(screen.getByRole('button', { name: '创建分支' }))
    expect(onSubmit).toHaveBeenCalledWith('feature/renamed', true)
  })

  it('switches instead of creating when the local branch already exists', () => {
    const onSubmit = vi.fn()
    render(
      <RemoteBranchCreateDialog
        branch={branch}
        remote={remote}
        existingLocalNames={['feature/login']}
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '切换到现有分支' }))
    expect(onSubmit).toHaveBeenCalledWith('feature/login', true)
  })

  it('blocks an existing branch when checkout is disabled', () => {
    const onSubmit = vi.fn()
    render(
      <RemoteBranchCreateDialog
        branch={branch}
        remote={remote}
        existingLocalNames={['feature/login']}
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    fireEvent.click(screen.getByLabelText('创建成功后切换到该分支'))
    expect(screen.getByText('同名本地分支已存在；勾选切换后才能继续。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '创建分支' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
