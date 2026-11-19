import { describe, expect, it } from 'vitest'
import type { ConflictBlockState } from './conflictSessions'
import { findConflictCodeRange } from './conflictCodeRange'

function block(index: number, ours: string, theirs: string): ConflictBlockState {
  return {
    id: `conflict-${index}`,
    status: 'unresolved',
    original: {
      index,
      startLine: 0,
      endLine: 0,
      ours,
      base: null,
      theirs
    }
  }
}

describe('conflict code ranges', () => {
  it('finds the current block range in the full side content', () => {
    const text = 'before\nours one\nafter\nours two\nend'
    const blocks = [block(0, 'ours one', 'theirs one'), block(1, 'ours two', 'theirs two')]
    expect(findConflictCodeRange(text, blocks, 1, 'ours')).toEqual({
      startLine: 3,
      endLine: 3
    })
  })

  it('supports multi-line ranges and optional base', () => {
    const text = 'before\nbase one\nbase two\nafter'
    const item = block(0, 'ours', 'theirs')
    item.original.base = 'base one\nbase two'
    expect(findConflictCodeRange(text, [item], 0, 'base')).toEqual({
      startLine: 1,
      endLine: 2
    })
  })

  it('returns null for empty and missing sides', () => {
    expect(findConflictCodeRange('text', [block(0, '', 'theirs')], 0, 'ours')).toBeNull()
    expect(findConflictCodeRange('text', [block(0, 'ours', 'theirs')], 0, 'base')).toBeNull()
  })
})
