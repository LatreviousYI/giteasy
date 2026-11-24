// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommitDetail, useCommitDiff, useCommitIsAncestor } from '../../lib/queries'
import { CommitDetailPane } from './HistoryDetails'

vi.mock('../../lib/queries', () => ({
  useCommitDetail: vi.fn(),
  useCommitDiff: vi.fn(),
  useCommitIsAncestor: vi.fn()
}))

const commit = {
  oid: '1111111111111111111111111111111111111111',
  shortOid: '1111111',
  parents: ['0000000000000000000000000000000000000000'],
  authorName: 'Demo User',
  authorEmail: 'demo@example.com',
  time: 1_700_000_000,
  subject: 'remote commit',
  body: '',
  refs: [{ name: 'origin/feature', kind: 'remote' }]
}

function renderPane(overrides: Partial<Parameters<typeof CommitDetailPane>[0]> = {}) {
  render(
    <CommitDetailPane
      repoPath="/tmp/repo"
      oid={commit.oid}
      busy={false}
      currentBranch="main"
      operationState="clean"
      ignoreWhitespace={false}
      onToggleWhitespace={vi.fn()}
      contextLines={3}
      onContextLinesChange={vi.fn()}
      onCheckout={vi.fn()}
      onCherryPick={vi.fn()}
      onRevert={vi.fn()}
      onRebase={vi.fn()}
      onCopy={vi.fn()}
      onReset={vi.fn()}
      focusMode={false}
      onToggleFocus={vi.fn()}
      {...overrides}
    />
  )
}

afterEach(cleanup)

beforeEach(() => {
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    } as unknown as Storage
  })
  vi.mocked(useCommitDetail).mockReturnValue({
    data: { commit, files: [] },
    isLoading: false
  } as unknown as ReturnType<typeof useCommitDetail>)
  vi.mocked(useCommitDiff).mockReturnValue({
    data: null
  } as unknown as ReturnType<typeof useCommitDiff>)
})

describe('CommitDetailPane actions', () => {
  it('disables revert for a remote commit outside current history', () => {
    vi.mocked(useCommitIsAncestor).mockReturnValue({
      data: false,
      isLoading: false
    } as unknown as ReturnType<typeof useCommitIsAncestor>)
    renderPane()

    fireEvent.click(screen.getByRole('button', { name: /更多/ }))
    const revert = screen.getByRole('button', { name: '回滚提交' }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    expect(revert.title).toContain('不在当前分支历史中')
  })

  it('allows revert when the selected commit is an ancestor', () => {
    vi.mocked(useCommitIsAncestor).mockReturnValue({
      data: true,
      isLoading: false
    } as unknown as ReturnType<typeof useCommitIsAncestor>)
    renderPane()

    fireEvent.click(screen.getByRole('button', { name: /更多/ }))
    expect((screen.getByRole('button', { name: '回滚提交' }) as HTMLButtonElement).disabled).toBe(
      false
    )
  })

  it('disables branch actions when no local branch is checked out', () => {
    vi.mocked(useCommitIsAncestor).mockReturnValue({
      data: true,
      isLoading: false
    } as unknown as ReturnType<typeof useCommitIsAncestor>)
    renderPane({ currentBranch: null })

    expect((screen.getByRole('button', { name: '拣选' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /更多/ }))
    const revert = screen.getByRole('button', { name: '回滚提交' }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    expect(revert.title).toBe('请先检出本地分支')
  })
})
