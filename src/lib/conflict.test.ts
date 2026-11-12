import { describe, expect, it } from 'vitest'
import {
  parseConflictBlocks,
  resolveAllConflictBlocks,
  resolveConflictBlock
} from './conflict'

describe('conflict block resolution', () => {
  it('parses merge-style conflict markers', () => {
    const text = [
      'before',
      '<<<<<<< HEAD',
      'value = ours',
      '=======',
      'value = theirs',
      '>>>>>>> feature/demo',
      'after'
    ].join('\n')

    expect(parseConflictBlocks(text)).toEqual([
      expect.objectContaining({
        index: 0,
        ours: 'value = ours',
        base: null,
        theirs: 'value = theirs'
      })
    ])
  })

  it('parses diff3-style conflict markers with the common base', () => {
    const text = [
      '<<<<<<< HEAD',
      'ours',
      '||||||| base',
      'base',
      '=======',
      'theirs',
      '>>>>>>> feature/demo'
    ].join('\n')

    expect(parseConflictBlocks(text)[0]).toEqual(
      expect.objectContaining({
        ours: 'ours',
        base: 'base',
        theirs: 'theirs'
      })
    )
  })

  it('resolves one block without changing other blocks or surrounding text', () => {
    const text = [
      'start',
      '<<<<<<< HEAD',
      'first ours',
      '=======',
      'first theirs',
      '>>>>>>> feature/demo',
      'middle',
      '<<<<<<< HEAD',
      'second ours',
      '=======',
      'second theirs',
      '>>>>>>> feature/demo',
      'end'
    ].join('\n')

    const resolved = resolveConflictBlock(text, 1, 'theirs')
    const remaining = parseConflictBlocks(resolved)

    expect(remaining).toHaveLength(1)
    expect(resolved).toContain('first ours')
    expect(resolved).toContain('first theirs')
    expect(resolved).toContain('second theirs')
    expect(resolved).not.toContain('second ours')
    expect(resolved).toContain('start')
    expect(resolved).toContain('middle')
    expect(resolved).toContain('end')
  })

  it('resolves all blocks using the requested strategy', () => {
    const text = [
      '<<<<<<< HEAD',
      'ours one',
      '=======',
      'theirs one',
      '>>>>>>> feature/demo',
      'middle',
      '<<<<<<< HEAD',
      'ours two',
      '=======',
      'theirs two',
      '>>>>>>> feature/demo'
    ].join('\n')

    const resolved = resolveAllConflictBlocks(text, 'both')

    expect(resolved.count).toBe(2)
    expect(parseConflictBlocks(resolved.text)).toHaveLength(0)
    expect(resolved.text).toBe(
      ['ours one', 'theirs one', 'middle', 'ours two', 'theirs two'].join('\n')
    )
  })
})
