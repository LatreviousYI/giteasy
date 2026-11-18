// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useWindowDrag } from './useWindowDrag'

const { getCurrentWindow } = vi.hoisted(() => ({
  getCurrentWindow: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow }))

function mouseEvent(target: Element) {
  return {
    button: 0,
    target
  } as unknown as ReactMouseEvent<HTMLElement>
}

describe('useWindowDrag', () => {
  const startDragging = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })
    getCurrentWindow.mockReturnValue({ startDragging })
    startDragging.mockClear()
  })

  it('starts dragging from titlebar background and text', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useWindowDrag(onError))
    const background = document.createElement('div')
    const text = document.createElement('span')

    await act(async () => {
      result.current(mouseEvent(background))
      result.current(mouseEvent(text))
    })

    expect(startDragging).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('does not drag from interactive controls', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useWindowDrag(onError))
    const wrapper = document.createElement('div')
    const button = document.createElement('button')
    wrapper.appendChild(button)

    result.current(mouseEvent(button))

    expect(startDragging).not.toHaveBeenCalled()
  })
})
