// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ConflictFile } from '../../lib/types'
import { useConflictSessions } from './useConflictSessions'

const content = ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> demo'].join('\n')

function file(path: string): ConflictFile {
  return {
    path,
    ours: 'ours',
    theirs: 'theirs',
    base: null,
    result: content,
    binary: false
  }
}

describe('useConflictSessions', () => {
  it('keeps independent undo stacks when files are switched and rerendered', async () => {
    const files = [file('a.txt'), file('b.txt')]
    const { result, rerender } = renderHook(() => useConflictSessions(files))

    await waitFor(() => {
      expect(result.current.sessions['a.txt']).toBeTruthy()
      expect(result.current.sessions['b.txt']).toBeTruthy()
    })

    act(() => result.current.applyChoice('a.txt', 'ours'))
    act(() => result.current.applyChoice('b.txt', 'theirs'))

    expect(result.current.sessions['a.txt'].undoStack).toHaveLength(1)
    expect(result.current.sessions['b.txt'].undoStack).toHaveLength(1)
    expect(result.current.sessions['a.txt'].content).not.toBe(
      result.current.sessions['b.txt'].content
    )

    rerender()
    expect(result.current.sessions['a.txt'].undoStack).toHaveLength(1)
    expect(result.current.sessions['b.txt'].undoStack).toHaveLength(1)
  })
})
