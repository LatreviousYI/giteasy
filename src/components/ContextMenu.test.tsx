// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenuDivider, ContextMenuItem, ContextMenuSurface } from './ContextMenu'

afterEach(cleanup)

describe('ContextMenu', () => {
  it('renders described and disabled menu items', () => {
    render(
      <ContextMenuSurface x={10} y={10} estimatedHeight={160} onDismiss={vi.fn()}>
        <ContextMenuItem description="解释动作结果" onClick={vi.fn()}>
          可用动作
        </ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem disabled title="当前不可用">
          禁用动作
        </ContextMenuItem>
      </ContextMenuSurface>
    )

    expect(screen.getByText('解释动作结果')).toBeTruthy()
    expect((screen.getByRole('button', { name: /禁用动作/ }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(screen.getByRole('button', { name: /禁用动作/ }).title).toBe('当前不可用')
  })

  it('runs an item action and dismisses from the backdrop', () => {
    const onClick = vi.fn()
    const onDismiss = vi.fn()
    const { container } = render(
      <ContextMenuSurface x={10} y={10} estimatedHeight={120} onDismiss={onDismiss}>
        <ContextMenuItem onClick={onClick}>执行动作</ContextMenuItem>
      </ContextMenuSurface>
    )

    fireEvent.click(screen.getByRole('button', { name: '执行动作' }))
    expect(onClick).toHaveBeenCalled()
    fireEvent.mouseDown(container.querySelector('.fixed.inset-0.z-40') as HTMLElement)
    expect(onDismiss).toHaveBeenCalled()
  })
})
