// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SidebarRepoMenu from './SidebarRepoMenu'

afterEach(cleanup)

describe('SidebarRepoMenu', () => {
  it('dismisses before opening a recent repository', async () => {
    const onDismiss = vi.fn()
    const onOpenRecent = vi.fn().mockResolvedValue(undefined)
    render(
      <SidebarRepoMenu
        repoPath="/tmp/current"
        recent={[{ path: '/tmp/recent', name: 'recent', lastOpened: 1 }]}
        onDismiss={onDismiss}
        onOpenRecent={onOpenRecent}
        onOpenDirectory={vi.fn()}
        onInitializeRepository={vi.fn()}
        onDiscoverRepositories={vi.fn()}
        onManageRemotes={vi.fn()}
        onOpenTerminal={vi.fn()}
        onCloseRepository={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /recent/ }))

    await waitFor(() => expect(onOpenRecent).toHaveBeenCalledWith('/tmp/recent'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('routes repository commands through the supplied actions', () => {
    const onOpenDirectory = vi.fn()
    const onManageRemotes = vi.fn()
    render(
      <SidebarRepoMenu
        repoPath="/tmp/current"
        recent={[]}
        onDismiss={vi.fn()}
        onOpenRecent={vi.fn()}
        onOpenDirectory={onOpenDirectory}
        onInitializeRepository={vi.fn()}
        onDiscoverRepositories={vi.fn()}
        onManageRemotes={onManageRemotes}
        onOpenTerminal={vi.fn()}
        onCloseRepository={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '打开其他仓库…' }))

    expect(onOpenDirectory).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '管理远程…' }))
    expect(onManageRemotes).toHaveBeenCalledOnce()
  })
})
