import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  History as HistoryIcon,
  SlidersHorizontal,
  Rows2,
  UserRound
} from 'lucide-react'
import type { DiffDto, DiffLine, Selection } from '../../lib/types'
import { statusMeta } from '../../lib/format'
import { Empty, Spinner } from '../../components/Empty'
import { useApp } from '../../store/app'
import { ipc } from '../../lib/ipc'
import ImageDiffViewer from './ImageDiffViewer'

interface InlineSegment {
  text: string
  changed: boolean
}

const MAX_RENDERED_DIFF_LINES = 3000

function tokenize(value: string) {
  return value.match(/\s+|[^\s]+/g) ?? []
}

export function diffSegments(oldValue: string, newValue: string) {
  const before = tokenize(oldValue)
  const after = tokenize(newValue)
  if (before.length * after.length > 20_000) {
    return {
      before: before.map((text) => ({ text, changed: true })),
      after: after.map((text) => ({ text, changed: true }))
    }
  }

  const matrix = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0)
  )
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      matrix[i][j] =
        before[i] === after[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1])
    }
  }

  const left: InlineSegment[] = []
  const right: InlineSegment[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      left.push({ text: before[i], changed: false })
      right.push({ text: after[j], changed: false })
      i += 1
      j += 1
    } else if (
      j >= after.length ||
      (i < before.length && matrix[i + 1][j] >= matrix[i][j + 1])
    ) {
      left.push({ text: before[i], changed: true })
      i += 1
    } else {
      right.push({ text: after[j], changed: true })
      j += 1
    }
  }
  return { before: left, after: right }
}

function buildInlineHighlights(lines: DiffLine[]) {
  const highlights = new Map<number, InlineSegment[]>()
  let cursor = 0
  while (cursor < lines.length) {
    if (lines[cursor].kind === 'context') {
      cursor += 1
      continue
    }
    const deleted: number[] = []
    const added: number[] = []
    while (cursor < lines.length && lines[cursor].kind === 'del') {
      deleted.push(cursor)
      cursor += 1
    }
    while (cursor < lines.length && lines[cursor].kind === 'add') {
      added.push(cursor)
      cursor += 1
    }
    const pairs = Math.min(deleted.length, added.length)
    for (let index = 0; index < pairs; index += 1) {
      const deletedIndex = deleted[index]
      const addedIndex = added[index]
      const segments = diffSegments(
        lines[deletedIndex].content,
        lines[addedIndex].content
      )
      highlights.set(deletedIndex, segments.before)
      highlights.set(addedIndex, segments.after)
    }
  }
  return highlights
}

interface DiffViewerProps {
  diff?: DiffDto | null
  loading?: boolean
  actionMode?: 'stage' | 'unstage'
  onApply?: (selections: Selection[]) => void
  applying?: boolean
  ignoreWhitespace?: boolean
  onToggleWhitespace?: (value: boolean) => void
  contextLines?: number
  onContextLinesChange?: (value: number) => void
  imageSource?:
    | { kind: 'workdir'; staged: boolean }
    | { kind: 'commit'; left: string }
    | { kind: 'range'; left: string; right: string }
  compactToolbar?: boolean
}

export default function DiffViewer({
  diff,
  loading,
  actionMode,
  onApply,
  applying,
  ignoreWhitespace,
  onToggleWhitespace,
  contextLines,
  onContextLinesChange,
  imageSource,
  compactToolbar = false
}: DiffViewerProps) {
  const [selected, setSelected] = useState<Record<number, number[]>>({})
  const openInspector = useApp((s) => s.openInspector)
  const repo = useApp((s) => s.repo)
  const errorToast = useApp((s) => s.errorToast)
  const toast = useApp((s) => s.toast)
  const hunkRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const diffBodyRef = useRef<HTMLDivElement>(null)
  const [activeHunk, setActiveHunk] = useState(0)
  const [showFullDiff, setShowFullDiff] = useState(false)
  const [compactMenuOpen, setCompactMenuOpen] = useState(false)

  const openInEditor = async () => {
    if (!repo || !diff) return
    try {
      await ipc.openInEditor(repo.path, diff.path)
    } catch (error) {
      errorToast(error)
    }
  }

  const copyPath = async () => {
    if (!diff) return
    try {
      await navigator.clipboard.writeText(diff.path)
      toast('success', '路径已复制')
    } catch {
      toast('warn', '无法访问剪贴板')
    }
  }

  useEffect(() => {
    setSelected({})
    setActiveHunk(0)
    setShowFullDiff(false)
    setCompactMenuOpen(false)
  }, [diff?.path, diff?.status, actionMode])

  const selectionCount = useMemo(
    () => Object.values(selected).reduce((total, lines) => total + lines.length, 0),
    [selected]
  )
  const selectedRange = useMemo(() => {
    if (!diff || selectionCount === 0) return null
    let start = Number.POSITIVE_INFINITY
    let end = 0
    for (const [hunkValue, lineIndexes] of Object.entries(selected)) {
      const hunk = diff.hunks[Number(hunkValue)]
      if (!hunk) continue
      for (const lineIndex of lineIndexes) {
        const line = hunk.lines[lineIndex]
        const lineNo = line?.newLineNo ?? line?.oldLineNo
        if (!lineNo) continue
        start = Math.min(start, lineNo)
        end = Math.max(end, lineNo)
      }
    }
    return end > 0 ? { lineStart: start, lineEnd: end } : null
  }, [diff, selected, selectionCount])
  const totalDiffLines = useMemo(
    () => diff?.hunks.reduce((total, hunk) => total + hunk.lines.length, 0) ?? 0,
    [diff]
  )
  const visibleHunks = useMemo(() => {
    if (!diff) return []
    if (showFullDiff) return diff.hunks
    let remaining = MAX_RENDERED_DIFF_LINES
    const result: typeof diff.hunks = []
    for (const hunk of diff.hunks) {
      if (remaining <= 0) break
      result.push({
        ...hunk,
        lines: hunk.lines.slice(0, remaining)
      })
      remaining -= Math.min(remaining, hunk.lines.length)
    }
    return result
  }, [diff, showFullDiff])
  const inlineHighlights = useMemo(
    () => visibleHunks.map((hunk) => buildInlineHighlights(hunk.lines)),
    [visibleHunks]
  )
  useLayoutEffect(() => {
    const body = diffBodyRef.current
    if (!body) return
    const updateContentWidth = () => {
      body.style.removeProperty('--diff-content-width')
      const width = Math.max(body.clientWidth, body.scrollWidth)
      body.style.setProperty('--diff-content-width', `${width}px`)
    }
    updateContentWidth()
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateContentWidth)
    observer?.observe(body)
    window.addEventListener('resize', updateContentWidth)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateContentWidth)
    }
  }, [diff?.path, diff?.status, visibleHunks, showFullDiff])

  if (loading) {
    return (
      <div className="diff-pane">
        <Empty icon={<Spinner />} title="正在读取差异…" />
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="diff-pane">
        <Empty
          icon={<Rows2 size={20} />}
          title="选择文件查看差异"
          subtitle="在左侧列表中选择一个文件，这里会显示它的改动内容。"
        />
      </div>
    )
  }

  const meta = statusMeta[diff.status] ?? statusMeta.modified
  const selectable = !!onApply

  const toggleLine = (hunkIndex: number, lineIndex: number, line: DiffLine) => {
    if (!selectable || line.kind === 'context') return
    setSelected((prev) => {
      const current = prev[hunkIndex] ?? []
      const next = current.includes(lineIndex)
        ? current.filter((item) => item !== lineIndex)
        : [...current, lineIndex]
      const updated = { ...prev }
      if (next.length === 0) delete updated[hunkIndex]
      else updated[hunkIndex] = next
      return updated
    })
  }

  const isSelected = (hunkIndex: number, lineIndex: number) =>
    (selected[hunkIndex] ?? []).includes(lineIndex)

  const applySelected = () => {
    if (!onApply) return
    const selections = Object.entries(selected)
      .filter(([, lines]) => lines.length > 0)
      .map(([hunk, lines]) => ({ hunk: Number(hunk), lines }))
    if (selections.length === 0) return
    onApply(selections)
    setSelected({})
  }

  const applyHunk = (hunkIndex: number) => {
    onApply?.([{ hunk: hunkIndex, lines: [] }])
  }

  const actionLabel = actionMode === 'stage' ? '暂存' : '取消暂存'
  const jumpHunk = (delta: number) => {
    if (!diff || visibleHunks.length === 0) return
    const next = Math.max(
      0,
      Math.min(visibleHunks.length - 1, activeHunk + delta)
    )
    setActiveHunk(next)
    hunkRefs.current[next]?.scrollIntoView({ block: 'start' })
  }
  const renderCode = (hunkIndex: number, content: string, lineIndex: number) => {
    const segments = inlineHighlights[hunkIndex]?.get(lineIndex)
    if (!segments) return content || ' '
    return segments.map((segment, index) => (
      <span
        key={`${index}-${segment.text}`}
        className={segment.changed ? 'word-change' : undefined}
      >
        {segment.text}
      </span>
    ))
  }
  return (
    <div className="diff-pane">
      <div className="diff-head">
        <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
        <span className="diff-file" title={diff.oldPath ? `${diff.oldPath} → ${diff.path}` : diff.path}>
          {diff.oldPath ? `${diff.oldPath} → ${diff.path}` : diff.path}
        </span>
        <span className="diff-stat">
          <span className="plus">+{diff.additions}</span> <span className="minus">-{diff.deletions}</span>
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        {visibleHunks.length > 0 && (
          <div className="diff-mini-group" title="变更块导航">
            <button
              className="icon-btn"
              title="上一处变更"
              onClick={() => jumpHunk(-1)}
              disabled={activeHunk <= 0}
            >
              <ChevronUp size={14} />
            </button>
            <span>
              {Math.min(activeHunk + 1, visibleHunks.length)}/{visibleHunks.length}
            </span>
            <button
              className="icon-btn"
              title="下一处变更"
              onClick={() => jumpHunk(1)}
              disabled={activeHunk >= visibleHunks.length - 1}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
        {compactToolbar ? (
          <div className="relative">
            <button
              className="btn btn-sm"
              title="Diff 显示选项"
              onClick={() => setCompactMenuOpen((open) => !open)}
            >
              <SlidersHorizontal size={13} />
              显示
            </button>
            {compactMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCompactMenuOpen(false)} />
                <div className="diff-options-menu">
                  {onContextLinesChange && (
                    <label>
                      <span>上下文行数</span>
                      <select
                        className="select"
                        value={contextLines ?? 3}
                        onChange={(event) =>
                          onContextLinesChange(Number(event.target.value))
                        }
                      >
                        {[1, 3, 5, 8, 12].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {onToggleWhitespace && (
                    <button
                      className={ignoreWhitespace ? 'active' : ''}
                      onClick={() => {
                        onToggleWhitespace(!ignoreWhitespace)
                        setCompactMenuOpen(false)
                      }}
                    >
                      {ignoreWhitespace ? '✓ ' : ''}忽略空白
                    </button>
                  )}
                  <button
                    onClick={() => {
                      void openInEditor()
                      setCompactMenuOpen(false)
                    }}
                  >
                    <ExternalLink size={12} /> 在编辑器中打开
                  </button>
                  <button
                    onClick={() => {
                      void copyPath()
                      setCompactMenuOpen(false)
                    }}
                  >
                    <Copy size={12} /> 复制文件路径
                  </button>
                  <button
                    onClick={() => {
                      openInspector(diff.path, 'history')
                      setCompactMenuOpen(false)
                    }}
                  >
                    <HistoryIcon size={12} /> 文件历史
                  </button>
                  <button
                    onClick={() => {
                      openInspector(diff.path, 'blame')
                      setCompactMenuOpen(false)
                    }}
                  >
                    <UserRound size={12} /> 查看 Blame
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {onContextLinesChange && (
              <select
                className="select"
                style={{ width: 88, height: 26, fontSize: 10.5, padding: '0 6px' }}
                value={contextLines ?? 3}
                title="上下文行数"
                onChange={(event) => onContextLinesChange(Number(event.target.value))}
              >
                {[1, 3, 5, 8, 12].map((value) => (
                  <option key={value} value={value}>
                    上下文 {value}
                  </option>
                ))}
              </select>
            )}
            {onToggleWhitespace && (
              <button
                className={`btn btn-sm ${ignoreWhitespace ? 'btn-primary' : 'btn-ghost'}`}
                title="忽略只包含空白字符的差异"
                onClick={() => onToggleWhitespace(!ignoreWhitespace)}
              >
                忽略空白
              </button>
            )}
            <button className="icon-btn" title="在编辑器中打开" onClick={openInEditor}>
              <ExternalLink size={14} />
            </button>
            <button className="icon-btn" title="复制文件路径" onClick={copyPath}>
              <Copy size={14} />
            </button>
            <button
              className="icon-btn"
              title="文件历史"
              onClick={() => openInspector(diff.path, 'history')}
            >
              <HistoryIcon size={14} />
            </button>
            <button
              className="icon-btn"
              title="查看 Blame"
              onClick={() => openInspector(diff.path, 'blame')}
            >
              <UserRound size={14} />
            </button>
          </>
        )}
      </div>

      <div className="diff-body" ref={diffBodyRef}>
        {selectionCount > 0 && onApply && (
          <div className="hunk-head" style={{ position: 'sticky', top: 0, zIndex: 4 }}>
            <span>已选择 {selectionCount} 行</span>
            <span style={{ flex: 1 }} />
            <div className="hunk-actions">
              {selectedRange && (
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    openInspector(diff.path, 'history', selectedRange)
                  }
                >
                  选中行历史
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={applySelected} disabled={applying}>
                {applying ? '处理中…' : `${actionLabel}选中行`}
              </button>
              <button className="btn btn-sm" onClick={() => setSelected({})} disabled={applying}>
                清除
              </button>
            </div>
          </div>
        )}

        {diff.binary ? (
          imageSource &&
          /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(diff.path) &&
          repo ? (
            <ImageDiffViewer
              repoPath={repo.path}
              file={diff.path}
              source={
                imageSource.kind === 'workdir'
                  ? 'workdir'
                  : imageSource.kind === 'commit'
                    ? 'commit'
                    : 'range'
              }
              left={'left' in imageSource ? imageSource.left : null}
              right={'right' in imageSource ? imageSource.right : null}
              staged={imageSource.kind === 'workdir' ? imageSource.staged : undefined}
            />
          ) : (
            <div className="binary-note">二进制文件，无法显示文本差异</div>
          )
        ) : visibleHunks.length === 0 ? (
          <div className="diff-empty">该文件没有可显示的文本改动。</div>
        ) : (
          <>
            {!showFullDiff && totalDiffLines > MAX_RENDERED_DIFF_LINES && (
              <div className="hunk-head">
                <span>
                  大型差异已截断，当前显示前 {MAX_RENDERED_DIFF_LINES} 行，
                  共 {totalDiffLines} 行。
                </span>
                <span style={{ flex: 1 }} />
                <button className="btn btn-sm" onClick={() => setShowFullDiff(true)}>
                  加载完整差异
                </button>
              </div>
            )}
            {visibleHunks.map((hunk, hunkIndex) => (
              <div
                key={`${hunk.header}-${hunkIndex}`}
                ref={(node) => {
                  hunkRefs.current[hunkIndex] = node
                }}
              >
                <div className="hunk-head">
                  <span className="hunk-text mono">{hunk.header}</span>
                  {onApply && (
                    <div className="hunk-actions">
                      <button
                        className="btn btn-sm"
                        onClick={() => applyHunk(hunkIndex)}
                        disabled={applying}
                      >
                        {actionLabel}此块
                      </button>
                    </div>
                  )}
                </div>

                {hunk.lines.map((line, lineIndex) => (
                  <div
                    key={lineIndex}
                    className={`diff-line ${line.kind} ${
                      isSelected(hunkIndex, lineIndex) ? 'selected' : ''
                    }`}
                    onClick={() => toggleLine(hunkIndex, lineIndex, line)}
                  >
                    <span className="gutter">{line.oldLineNo ?? ''}</span>
                    <span className="gutter">{line.newLineNo ?? ''}</span>
                    <span className="sign">
                      {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}
                    </span>
                    <span className="code">
                      {renderCode(hunkIndex, line.content, lineIndex)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
