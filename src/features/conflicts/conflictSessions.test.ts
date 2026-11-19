import { describe, expect, it } from 'vitest'
import {
  allConflictBlocksResolved,
  applyAllConflictChoices,
  applyConflictChoice,
  beginConflictEdit,
  createConflictSession,
  endConflictEdit,
  navigateConflictBlock,
  undoConflictSession,
  unresolvedConflictCount,
  updateConflictSessionContent
} from './conflictSessions'

function multiBlockContent() {
  return [
    'before',
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
    '>>>>>>> feature/demo',
    'end'
  ].join('\n')
}

describe('conflict sessions', () => {
  it('resolves only the current block and does not navigate automatically', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const next = applyConflictChoice(session, 'ours')

    expect(next.content).toContain('ours one')
    expect(next.content).toContain('<<<<<<< HEAD\nours two')
    expect(next.currentBlock).toBe(0)
    expect(unresolvedConflictCount(next.content)).toBe(1)
  })

  it('supports mixed per-block choices', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const first = applyConflictChoice(session, 'ours')
    const second = navigateConflictBlock(first, 'next')
    const resolved = applyConflictChoice(second, 'theirs')

    expect(resolved.content).not.toContain('<<<<<<<')
    expect(resolved.content).toContain('ours one')
    expect(resolved.content).toContain('theirs two')
    expect(allConflictBlocksResolved(resolved)).toBe(true)
  })

  it('undoes repeated operations back to the original conflicts', () => {
    const original = createConflictSession('/repo/file.txt', multiBlockContent())
    const first = applyConflictChoice(original, 'both')
    const second = navigateConflictBlock(first, 'next')
    const third = applyConflictChoice(second, 'theirs')

    const undoOne = undoConflictSession(third)
    const undoTwo = undoConflictSession(undoOne)
    const undoThree = undoConflictSession(undoTwo)

    expect(unresolvedConflictCount(undoOne.content)).toBe(1)
    expect(unresolvedConflictCount(undoTwo.content)).toBe(2)
    expect(undoThree.content).toBe(original.content)
    expect(undoThree.undoStack).toHaveLength(0)
  })

  it('groups one manual editing session into one undo point', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const editing = beginConflictEdit(session)
    const changed = updateConflictSessionContent(editing, `${editing.content}\nmanual`)
    const finished = endConflictEdit(changed)
    const undone = undoConflictSession(finished)

    expect(finished.undoStack).toHaveLength(1)
    expect(undone.content).toBe(session.content)
  })

  it('keeps undo histories independent by file', () => {
    const first = createConflictSession('/repo/a.txt', multiBlockContent())
    const second = createConflictSession('/repo/b.txt', multiBlockContent())
    const firstChanged = applyConflictChoice(first, 'ours')
    const secondChanged = applyConflictChoice(navigateConflictBlock(second, 'next'), 'theirs')

    expect(undoConflictSession(firstChanged).content).toBe(first.content)
    expect(undoConflictSession(secondChanged).content).toBe(second.content)
  })

  it('prefers the next unresolved block before wrapping to resolved blocks', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const resolvedFirst = applyConflictChoice(session, 'ours')
    const next = navigateConflictBlock(resolvedFirst, 'next')
    const previous = navigateConflictBlock(next, 'previous')

    expect(next.currentBlock).toBe(1)
    expect(previous.currentBlock).toBe(1)
  })

  it('applies all choices in one undoable operation', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const resolved = applyAllConflictChoices(session, 'both')
    const undone = undoConflictSession(resolved)

    expect(allConflictBlocksResolved(resolved)).toBe(true)
    expect(resolved.content).toContain('ours one\ntheirs one')
    expect(undone.content).toBe(session.content)
  })

  it('treats manually removed markers as resolved', () => {
    const session = createConflictSession('/repo/file.txt', multiBlockContent())
    const manual = updateConflictSessionContent(session, 'fully resolved manually')

    expect(unresolvedConflictCount(manual.content)).toBe(0)
    expect(manual.blocks.every((block) => block.status === 'custom')).toBe(true)
  })
})
