// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResetBranchDialog from './ResetBranchDialog'

afterEach(cleanup)

describe('ResetBranchDialog', () => {
  it('defaults to mixed and submits the selected mode', () => {
    const onSubmit = vi.fn()
    render(
      <ResetBranchDialog
        currentBranch="main"
        target="origin/feature/login"
        targetOid="0123456789012345678901234567890123456789"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    expect((screen.getByLabelText(/Mixed/) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText(/Hard/))
    expect(screen.getByText('Hard 会丢弃未提交改动，无法通过 GitEasy 恢复。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '丢弃改动并重置' }))
    expect(onSubmit).toHaveBeenCalledWith('hard')
  })
})
