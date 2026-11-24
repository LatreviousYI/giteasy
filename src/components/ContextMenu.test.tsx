// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenuDivider, ContextMenuItem, ContextMenuSurface } from './ContextMenu'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
})

describe('ContextMenu', () => {
  it('renders described and disabled menu items', () => {
    render(
      <ContextMenuSurface x={10} y={10} onDismiss={vi.fn()}>
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
    render(
      <ContextMenuSurface x={10} y={10} onDismiss={onDismiss}>
        <ContextMenuItem onClick={onClick}>执行动作</ContextMenuItem>
      </ContextMenuSurface>
    )

    fireEvent.click(screen.getByRole('button', { name: '执行动作' }))
    expect(onClick).toHaveBeenCalled()
    fireEvent.mouseDown(document.querySelector('.fixed.inset-0.z-40') as HTMLElement)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders in a viewport portal instead of the triggering container', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>
        <ContextMenuSurface x={10} y={10} onDismiss={vi.fn()}>
          <ContextMenuItem>Portal 动作</ContextMenuItem>
        </ContextMenuSurface>
      </div>
    )

    expect(container.querySelector('.context-menu-surface')).toBeNull()
    expect(document.body.querySelector('.context-menu-surface')).toBeTruthy()
  })

  it('positions itself from the pointer using the measured menu size', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.classList.contains('context-menu-surface')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 320,
          bottom: 200,
          width: 320,
          height: 200,
          toJSON: () => ({})
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({})
      } as DOMRect
    })

    render(
      <ContextMenuSurface x={1180} y={790} onDismiss={vi.fn()}>
        <ContextMenuItem>边界动作</ContextMenuItem>
      </ContextMenuSurface>
    )

    const menu = screen.getByRole('menu')
    await waitFor(() => {
      expect(menu.style.left).toBe('872px')
      expect(menu.style.top).toBe('590px')
      expect(menu.style.visibility).toBe('visible')
    })
  })
})
