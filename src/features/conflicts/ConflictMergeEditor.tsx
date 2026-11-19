import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Columns3, ExternalLink, Undo2 } from 'lucide-react'
import type { ConflictChoice } from '../../lib/conflict'
import type { ConflictFile } from '../../lib/types'
import ConflictCodePane from './ConflictCodePane'
import ConflictPaneSplitter from './ConflictPaneSplitter'
import { findConflictCodeRange } from './conflictCodeRange'
import {
  CONFLICT_PANE_STORAGE_KEY,
  clampConflictVersionsPercent,
  readConflictVersionsPercent,
  resizeConflictVersionsPercent
} from './conflictPaneSize'
import {
  allConflictBlocksResolved,
  unresolvedConflictCount,
  type ConflictBlockStatus,
  type ConflictFileSession
} from './conflictSessions'

interface ConflictMergeEditorProps {
  file: ConflictFile
  session: ConflictFileSession
  busy: boolean
  onNavigate: (direction: 'previous' | 'next') => void
  onApplyChoice: (choice: ConflictChoice) => void
  onApplyAll: (choice: ConflictChoice) => void
  onBeginEdit: () => void
  onUpdateContent: (content: string) => void
  onEndEdit: () => void
  onUndo: () => void
  onOpenExternal: () => void
  onResolve: () => void
}

const STATUS_LABELS: Record<ConflictBlockStatus, string> = {
  unresolved: '未解决',
  ours: '已采用我的',
  theirs: '已采用对方',
  both: '已保留两者',
  custom: '已手动处理'
}

export default function ConflictMergeEditor({
  file,
  session,
  busy,
  onNavigate,
  onApplyChoice,
  onApplyAll,
  onBeginEdit,
  onUpdateContent,
  onEndEdit,
  onUndo,
  onOpenExternal,
  onResolve
}: ConflictMergeEditorProps) {
  const [showBase, setShowBase] = useState(false)
  const [topPercent, setTopPercent] = useState(() =>
    readConflictVersionsPercent(window.localStorage.getItem(CONFLICT_PANE_STORAGE_KEY))
  )
  const bodyRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.localStorage.setItem(CONFLICT_PANE_STORAGE_KEY, String(topPercent))
  }, [topPercent])

  const currentBlock = session.blocks[session.currentBlock]
  const remaining = unresolvedConflictCount(session.content)
  const resolved = Math.max(0, session.blocks.length - remaining)
  const currentStatus = currentBlock?.status ?? 'custom'
  const canApplyBlock = currentStatus === 'unresolved' && !file.binary && !busy
  const canResolve = !busy && (file.binary || allConflictBlocksResolved(session))
  const resultLines = useMemo(() => session.content.split('\n'), [session.content])

  const oursRange = findConflictCodeRange(
    file.ours ?? '',
    session.blocks,
    session.currentBlock,
    'ours'
  )
  const theirsRange = findConflictCodeRange(
    file.theirs ?? '',
    session.blocks,
    session.currentBlock,
    'theirs'
  )
  const baseRange = showBase
    ? findConflictCodeRange(file.base ?? '', session.blocks, session.currentBlock, 'base')
    : null

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current
    if (!body) return
    event.preventDefault()
    const startY = event.clientY
    const startPercent = topPercent
    const height = body.getBoundingClientRect().height
    const onMove = (moveEvent: PointerEvent) => {
      const next = resizeConflictVersionsPercent(startPercent, moveEvent.clientY - startY, height)
      setTopPercent(clampConflictVersionsPercent(next))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const undo = () => {
    onEndEdit()
    onUndo()
  }

  return (
    <div className="conflict-merge-editor">
      <div className="conflict-editor-head">
        <span className="conflict-editor-path mono" title={file.path}>
          {file.path}
        </span>
        <span className="spacer" />
        <span className="conflict-block-progress">
          第 {session.blocks.length === 0 ? 0 : session.currentBlock + 1}/{session.blocks.length} 块
        </span>
        <span className={`conflict-status conflict-status-${currentStatus}`}>
          {STATUS_LABELS[currentStatus]}
        </span>
        <button
          className="icon-btn"
          onClick={() => onNavigate('previous')}
          disabled={session.blocks.length === 0}
          title="上一块"
          aria-label="上一块"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className="icon-btn"
          onClick={() => onNavigate('next')}
          disabled={session.blocks.length === 0}
          title="下一块"
          aria-label="下一块"
        >
          <ChevronRight size={14} />
        </button>
        <button
          className={`btn btn-sm ${showBase ? 'btn-primary' : ''}`}
          onClick={() => setShowBase((value) => !value)}
          title={showBase ? '隐藏共同祖先' : '显示共同祖先'}
          aria-pressed={showBase}
        >
          <Columns3 size={12} />
          base
        </button>
        <button className="btn btn-sm" onClick={onOpenExternal} disabled={busy}>
          <ExternalLink size={12} />
          外部工具
        </button>
      </div>

      <div
        ref={bodyRef}
        className="conflict-body"
        style={{ gridTemplateRows: `${topPercent}% 7px minmax(0, 1fr)` }}
      >
        <div className="conflict-merge-top">
          <div
            className={`conflict-code-grid ${showBase ? 'with-base' : ''} ${
              file.binary ? 'binary' : ''
            }`}
          >
            {file.binary ? (
              <div className="binary-note">
                二进制冲突无法内嵌合并，请使用外部工具处理后标记为已解决。
              </div>
            ) : (
              <>
                <ConflictCodePane
                  label="Theirs（对方）"
                  text={file.theirs ?? ''}
                  range={theirsRange}
                />
                {showBase && (
                  <ConflictCodePane
                    label="Base（共同祖先）"
                    text={file.base ?? ''}
                    range={baseRange}
                  />
                )}
                <ConflictCodePane label="Ours（我的）" text={file.ours ?? ''} range={oursRange} />
              </>
            )}
          </div>

          <div className="conflict-block-actions">
            <span>
              已解决 <b>{resolved}</b> / {session.blocks.length} 块，剩余 <b>{remaining}</b> 块
            </span>
            <span className="spacer" />
            <button
              className="btn btn-sm"
              onClick={() => onApplyChoice('ours')}
              disabled={!canApplyBlock}
            >
              采用我的
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onApplyChoice('theirs')}
              disabled={!canApplyBlock}
            >
              采用对方
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onApplyChoice('both')}
              disabled={!canApplyBlock}
            >
              两者保留
            </button>
            <span className="conflict-action-divider" />
            <button
              className="btn btn-sm"
              onClick={() => onApplyAll('ours')}
              disabled={busy || file.binary || remaining === 0}
            >
              全部我的
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onApplyAll('theirs')}
              disabled={busy || file.binary || remaining === 0}
            >
              全部对方
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onApplyAll('both')}
              disabled={busy || file.binary || remaining === 0}
            >
              全部两者
            </button>
            <button
              className="icon-btn"
              onClick={undo}
              disabled={session.undoStack.length === 0}
              title="撤销上一步"
              aria-label="撤销上一步"
            >
              <Undo2 size={14} />
            </button>
          </div>
        </div>

        <ConflictPaneSplitter
          percent={topPercent}
          onChange={setTopPercent}
          onPointerDown={startResize}
        />

        <section className="conflict-result-editor" aria-label="合并结果">
          <div className="conflict-result-head">
            <span>合并结果</span>
            <span className="row-sub">所有块处理后才能保存</span>
            <span className="spacer" />
            <button className="btn btn-sm btn-primary" onClick={onResolve} disabled={!canResolve}>
              保存并标记已解决
            </button>
          </div>
          {!file.binary && (
            <div className="conflict-result-code">
              <div ref={gutterRef} className="conflict-result-gutter" aria-hidden="true">
                {resultLines.map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="conflict-result-textarea"
                value={session.content}
                onFocus={onBeginEdit}
                onBlur={onEndEdit}
                onChange={(event) => onUpdateContent(event.target.value)}
                onScroll={(event) => {
                  if (gutterRef.current) {
                    gutterRef.current.scrollTop = event.currentTarget.scrollTop
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    !event.shiftKey &&
                    event.key.toLowerCase() === 'z'
                  ) {
                    event.preventDefault()
                    undo()
                  }
                }}
                spellCheck={false}
                aria-label="合并结果编辑器"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
