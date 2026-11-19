// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConflictFile } from '../../lib/types'
import ConflictMergeEditor from './ConflictMergeEditor'
import { createConflictSession } from './conflictSessions'

const content = [
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

const file: ConflictFile = {
  path: 'src/conflict.ts',
  ours: content.replace('ours one', 'resolved ours one').replace('ours two', 'resolved ours two'),
  theirs: content
    .replace('theirs one', 'resolved theirs one')
    .replace('theirs two', 'resolved theirs two'),
  base: content,
  result: content,
  binary: false
}

function callbacks() {
  return {
    onNavigate: vi.fn(),
    onApplyChoice: vi.fn(),
    onApplyAll: vi.fn(),
    onBeginEdit: vi.fn(),
    onUpdateContent: vi.fn(),
    onEndEdit: vi.fn(),
    onUndo: vi.fn(),
    onOpenExternal: vi.fn(),
    onResolve: vi.fn()
  }
}

beforeEach(() => {
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  })
})

afterEach(cleanup)

describe('ConflictMergeEditor', () => {
  it('renders two panes and per-block actions without auto navigation', () => {
    const handlers = callbacks()
    render(
      <ConflictMergeEditor
        file={file}
        session={createConflictSession(file.path, content)}
        busy={false}
        {...handlers}
      />
    )

    expect(screen.getByText('Theirs（对方）')).toBeTruthy()
    expect(screen.getByText('Ours（我的）')).toBeTruthy()
    expect(screen.getByText('第 1/2 块')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: '保存并标记已解决' }) as HTMLButtonElement).disabled
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '采用我的' }))
    expect(handlers.onApplyChoice).toHaveBeenCalledWith('ours')
    expect(handlers.onNavigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '下一块' }))
    expect(handlers.onNavigate).toHaveBeenCalledWith('next')
  })

  it('shows the optional base pane and editable result', () => {
    const handlers = callbacks()
    render(
      <ConflictMergeEditor
        file={file}
        session={createConflictSession(file.path, content)}
        busy={false}
        {...handlers}
      />
    )

    fireEvent.click(screen.getByTitle('显示共同祖先'))
    expect(screen.getByText('Base（共同祖先）')).toBeTruthy()

    const editor = screen.getByLabelText('合并结果编辑器')
    fireEvent.focus(editor)
    fireEvent.change(editor, { target: { value: `${content}\nmanual` } })
    fireEvent.blur(editor)
    expect(handlers.onBeginEdit).toHaveBeenCalled()
    expect(handlers.onUpdateContent).toHaveBeenCalledWith(`${content}\nmanual`)
    expect(handlers.onEndEdit).toHaveBeenCalled()
  })

  it('routes undo and full-block shortcuts', () => {
    const handlers = callbacks()
    const session = createConflictSession(file.path, content)
    session.undoStack.push({
      content,
      statuses: session.blocks.map((block) => block.status),
      currentBlock: 0
    })
    render(<ConflictMergeEditor file={file} session={session} busy={false} {...handlers} />)

    fireEvent.click(screen.getByRole('button', { name: '撤销上一步' }))
    fireEvent.click(screen.getByRole('button', { name: '全部对方' }))
    expect(handlers.onUndo).toHaveBeenCalled()
    expect(handlers.onApplyAll).toHaveBeenCalledWith('theirs')
  })
})
