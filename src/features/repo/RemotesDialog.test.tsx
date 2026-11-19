// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepoInfo } from '../../lib/types'
import { useApp } from '../../store/app'
import RemotesDialog from './RemotesDialog'

const mocks = vi.hoisted(() => ({
  remoteAdd: vi.fn().mockResolvedValue(undefined),
  remoteUpdate: vi.fn().mockResolvedValue(undefined),
  remoteRemove: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn(),
  remoteState: {
    data: [{ name: 'gitee', url: 'git@gitee.com:demo/old.git' }],
    isLoading: false
  }
}))

vi.mock('../../lib/ipc', () => ({
  ipc: {
    remoteAdd: mocks.remoteAdd,
    remoteUpdate: mocks.remoteUpdate,
    remoteRemove: mocks.remoteRemove
  }
}))

vi.mock('../../lib/queries', () => ({
  useRemotes: () => mocks.remoteState,
  useInvalidateRepo: () => mocks.invalidate
}))

const repo: RepoInfo = {
  path: '/tmp/repo',
  name: 'repo',
  branch: 'dev',
  headOid: '0123456789012345678901234567890123456789',
  headShort: '0123456',
  detached: false,
  bare: false,
  remoteUrl: 'git@gitee.com:demo/old.git',
  state: 'clean'
}

beforeEach(() => {
  mocks.remoteAdd.mockClear()
  mocks.remoteUpdate.mockClear()
  mocks.remoteRemove.mockClear()
  mocks.invalidate.mockClear()
  mocks.remoteState.data = [{ name: 'gitee', url: 'git@gitee.com:demo/old.git' }]
  useApp.setState({ repo, toasts: [] })
})

afterEach(cleanup)

describe('RemotesDialog', () => {
  it('edits an existing remote name and URL', async () => {
    render(<RemotesDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('编辑远程 gitee'))

    fireEvent.change(screen.getByLabelText('remote 名称'), {
      target: { value: 'origin' }
    })
    fireEvent.change(screen.getByLabelText('remote URL'), {
      target: { value: 'git@example.com:demo/new.git' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(mocks.remoteUpdate).toHaveBeenCalledWith(
        '/tmp/repo',
        'gitee',
        'origin',
        'git@example.com:demo/new.git'
      )
    })
    expect(mocks.invalidate).toHaveBeenCalled()
  })

  it('cancels editing without calling the backend', () => {
    render(<RemotesDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('编辑远程 gitee'))
    fireEvent.change(screen.getByLabelText('remote 名称'), {
      target: { value: 'origin' }
    })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(mocks.remoteUpdate).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('remote 名称')).toBeNull()
  })

  it('adds a new remote from the same management dialog', async () => {
    render(<RemotesDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('名称，如 origin'), {
      target: { value: 'backup' }
    })
    fireEvent.change(screen.getByPlaceholderText('URL，如 git@github.com:user/repo.git'), {
      target: { value: 'git@example.com:demo/backup.git' }
    })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => {
      expect(mocks.remoteAdd).toHaveBeenCalledWith(
        '/tmp/repo',
        'backup',
        'git@example.com:demo/backup.git'
      )
    })
  })
})
