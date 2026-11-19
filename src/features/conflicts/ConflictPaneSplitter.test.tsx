// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConflictPaneSplitter from './ConflictPaneSplitter'

afterEach(cleanup)

describe('ConflictPaneSplitter', () => {
  it('exposes separator semantics and current percentage', () => {
    render(<ConflictPaneSplitter percent={35} onChange={vi.fn()} onPointerDown={vi.fn()} />)
    const separator = screen.getByRole('separator', { name: '调整冲突版本区高度' })
    expect(separator.getAttribute('aria-valuenow')).toBe('35')
    expect(separator.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('adjusts with arrow and boundary keys', () => {
    const onChange = vi.fn()
    render(<ConflictPaneSplitter percent={30} onChange={onChange} onPointerDown={vi.fn()} />)
    const separator = screen.getByRole('separator', { name: '调整冲突版本区高度' })

    fireEvent.keyDown(separator, { key: 'ArrowDown' })
    fireEvent.keyDown(separator, { key: 'ArrowUp' })
    fireEvent.keyDown(separator, { key: 'Home' })
    fireEvent.keyDown(separator, { key: 'End' })

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([32, 28, 18, 72])
  })
})
