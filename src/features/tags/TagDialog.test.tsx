// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import TagDialog from './TagDialog'

vi.mock('../../lib/ipc', () => ({
  ipc: {
    tagCreate: vi.fn()
  }
}))

vi.mock('../../lib/queries', () => ({
  useInvalidateRepo: () => vi.fn()
}))

afterEach(cleanup)

beforeEach(() => {
  vi.mocked(ipc.tagCreate).mockResolvedValue(undefined)
  useApp.setState({
    repo: {
      path: '/tmp/repo',
      name: 'repo',
      branch: 'main',
      headOid: '1111111111111111111111111111111111111111',
      headShort: '1111111',
      detached: false,
      bare: false,
      remoteUrl: null,
      state: 'clean'
    }
  })
})

describe('TagDialog', () => {
  it('creates the tag at the requested branch start point', async () => {
    const onClose = vi.fn()
    render(
      <TagDialog
        onClose={onClose}
        startPoint="origin/release/2.0"
        sourceLabel="origin/release/2.0"
      />
    )

    expect(screen.getByText('origin/release/2.0')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: 'v2.0.0' } })
    fireEvent.change(screen.getByLabelText('标签说明（可选，填写后创建附注标签）'), {
      target: { value: 'Release 2.0' }
    })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() =>
      expect(ipc.tagCreate).toHaveBeenCalledWith(
        '/tmp/repo',
        'v2.0.0',
        'Release 2.0',
        'origin/release/2.0'
      )
    )
    expect(onClose).toHaveBeenCalled()
  })
})
