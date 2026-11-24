// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommitDto } from '../../lib/types'
import { useLog } from '../../lib/queries'
import CommitSelectionDialog from './CommitSelectionDialog'

vi.mock('../../lib/queries', () => ({
  useLog: vi.fn()
}))

function commit(oid: string, subject: string, parents: string[]): CommitDto {
  return {
    oid,
    shortOid: oid.slice(0, 7),
    parents,
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: 1_700_000_000,
    subject,
    body: '',
    refs: []
  }
}

const commits = [
  commit('1111111111111111111111111111111111111111', 'first commit', [
    '0000000000000000000000000000000000000000'
  ]),
  commit('2222222222222222222222222222222222222222', 'second commit', [
    '1111111111111111111111111111111111111111'
  ]),
  commit('3333333333333333333333333333333333333333', 'merge commit', [
    '2222222222222222222222222222222222222222',
    '4444444444444444444444444444444444444444'
  ])
]

afterEach(cleanup)

beforeEach(() => {
  vi.mocked(useLog).mockReturnValue({
    data: { commits, hasMore: false },
    isLoading: false
  } as ReturnType<typeof useLog>)
})

describe('CommitSelectionDialog', () => {
  it('disables merge commits and submits selections in displayed order', () => {
    const onSubmit = vi.fn()
    render(
      <CommitSelectionDialog
        repoPath="/tmp/repo"
        mode="cherry-pick"
        sourceRef="origin/feature"
        sourceLabel="origin/feature"
        currentBranch="main"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    const merge = screen.getByLabelText(/merge commit/) as HTMLInputElement
    expect(merge.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/second commit/))
    fireEvent.click(screen.getByLabelText(/first commit/))
    fireEvent.click(screen.getByRole('button', { name: 'Cherry-pick 2 个提交' }))
    expect(onSubmit).toHaveBeenCalledWith([
      '1111111111111111111111111111111111111111',
      '2222222222222222222222222222222222222222'
    ])
  })

  it('keeps the primary action disabled without a valid selection', () => {
    render(
      <CommitSelectionDialog
        repoPath="/tmp/repo"
        mode="revert"
        sourceRef="HEAD"
        sourceLabel="main"
        currentBranch="main"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(
      (screen.getByRole('button', { name: '回滚 0 个提交' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('caps selection at 100 commits', () => {
    const many = Array.from({ length: 101 }, (_, index) =>
      commit(`${index + 1}`.padStart(40, '0'), `commit ${index + 1}`, [
        '0000000000000000000000000000000000000000'
      ])
    )
    vi.mocked(useLog).mockReturnValue({
      data: { commits: many, hasMore: false },
      isLoading: false
    } as ReturnType<typeof useLog>)
    render(
      <CommitSelectionDialog
        repoPath="/tmp/repo"
        mode="cherry-pick"
        sourceRef="origin/feature"
        sourceLabel="origin/feature"
        currentBranch="main"
        busy={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    for (const checkbox of checkboxes.slice(0, 100)) fireEvent.click(checkbox)
    expect(screen.getByRole('button', { name: 'Cherry-pick 100 个提交' })).toBeTruthy()
    expect(checkboxes[100].disabled).toBe(true)
  })
})
