// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SquashMergeDialog from './SquashMergeDialog'

afterEach(cleanup)

describe('SquashMergeDialog', () => {
  it('shows source and target and submits the edited commit message', () => {
    const onSubmit = vi.fn()
    render(
      <SquashMergeDialog
        source="origin/feature/login"
        target="main"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText('origin/feature/login')).toBeTruthy()
    expect(screen.getByText('main')).toBeTruthy()
    const message = screen.getByLabelText('最终提交信息') as HTMLTextAreaElement
    expect(message.value).toBe('Squash merge origin/feature/login into main')

    fireEvent.change(message, { target: { value: 'feat: squash login flow' } })
    fireEvent.click(screen.getByRole('button', { name: 'Squash 并提交' }))
    expect(onSubmit).toHaveBeenCalledWith('feat: squash login flow')
  })

  it('does not submit an empty commit message', () => {
    const onSubmit = vi.fn()
    render(
      <SquashMergeDialog
        source="feature/login"
        target="main"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText('最终提交信息'), { target: { value: '   ' } })
    expect(
      (screen.getByRole('button', { name: 'Squash 并提交' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
