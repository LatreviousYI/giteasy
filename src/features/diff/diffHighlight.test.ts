import { describe, expect, it } from 'vitest'
import { diffSegments } from './DiffViewer'

describe('token-level diff highlighting', () => {
  it('marks inserted tokens while keeping common tokens unchanged', () => {
    const result = diffSegments('hello world', 'hello brave world')
    expect(result.after.filter((segment) => segment.changed).map((segment) => segment.text)).toContain(
      'brave'
    )
    expect(result.before.some((segment) => !segment.changed && segment.text === 'hello')).toBe(
      true
    )
    expect(result.after.some((segment) => !segment.changed && segment.text === 'world')).toBe(
      true
    )
  })

  it('handles empty lines', () => {
    const result = diffSegments('', 'added')
    expect(result.before).toEqual([])
    expect(result.after.map((segment) => segment.text).join('')).toBe('added')
  })
})
