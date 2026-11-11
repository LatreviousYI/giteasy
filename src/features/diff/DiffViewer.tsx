import { useEffect, useMemo, useState } from 'react'
import {
  Columns2,
  ExternalLink,
  History as HistoryIcon,
  Rows2,
  UserRound
} from 'lucide-react'
import type { DiffDto, DiffLine, Selection } from '../../lib/types'
import { statusMeta } from '../../lib/format'
import { Empty, Spinner } from '../../components/Empty'
import { useApp } from '../../store/app'
import { ipc } from '../../lib/ipc'

interface SplitRow {
  left?: { line: DiffLine; index: number }
  right?: { line: DiffLine; index: number }
}

function buildSplit(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.kind === 'context') {
      rows.push({
        left: { line, index: i },
        right: { line, index: i }
      })
      i += 1
      continue
    }
    const dels: { line: DiffLine; index: number }[] = []
    const adds: { line: DiffLine; index: number }[] = []
    while (i < lines.length && lines[i].kind === 'del') {
      dels.push({ line: lines[i], index: i })
      i += 1
    }
    while (i < lines.length && lines[i].kind === 'add') {
      adds.push({ line: lines[i], index: i })
      i += 1
    }
    if (dels.length === 0 && adds.length === 0) {
      i += 1
      continue
    }
    const count = Math.max(dels.length, adds.length)
    for (let k = 0; k < count; k += 1) {
      rows.push({ left: dels[k], right: adds[k] })
    }
  }
  return rows
}

interface DiffViewerProps {
  diff?: DiffDto | null
  loading?: boolean
  layout: 'unified' | 'split'
  onLayoutChange: (layout: 'unified' | 'split') => void
  actionMode?: 'stage' | 'unstage'
  onApply?: (selections: Selection[]) => void
  applying?: boolean
  showLayoutToggle?: boolean
  ignoreWhitespace?: boolean
  onToggleWhitespace?: (value: boolean) => void
}

export default function DiffViewer({
  diff,
  loading,
  layout,
  onLayoutChange,
  actionMode,
  onApply,
  applying,
  showLayoutToggle = true,
  ignoreWhitespace,
  onToggleWhitespace
}: DiffViewerProps) {
  const [selected, setSelected] = useState<Record<number, number[]>>({})
  const openInspector = useApp((s) => s.openInspector)
  const repo = useApp((s) => s.repo)
  const errorToast = useApp((s) => s.errorToast)

  const openInEditor = async () => {
    if (!repo || !diff) return
    try {
      await ipc.openInEditor(repo.path, diff.path)
    } catch (error) {
      errorToast(error)
    }
  }

  useEffect(() => {
    setSelected({})
  }, [diff?.path, diff?.status, actionMode])

  const selectionCount = useMemo(
    () => Object.values(selected).reduce((total, lines) => total + lines.length, 0),
    [selected]
  )

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
        {showLayoutToggle && (
          <div className="seg">
            <button
              className={layout === 'unified' ? 'active' : ''}
              onClick={() => onLayoutChange('unified')}
              title="统一视图"
            >
              <Rows2 size={12} style={{ display: 'inline', marginRight: 4 }} />
              统一
            </button>
            <button
              className={layout === 'split' ? 'active' : ''}
              onClick={() => onLayoutChange('split')}
              title="分栏视图"
            >
              <Columns2 size={12} style={{ display: 'inline', marginRight: 4 }} />
              分栏
            </button>
          </div>
        )}
      </div>

      <div className="diff-body">
        {selectionCount > 0 && onApply && (
          <div className="hunk-head" style={{ position: 'sticky', top: 0, zIndex: 4 }}>
            <span>已选择 {selectionCount} 行</span>
            <span style={{ flex: 1 }} />
            <div className="hunk-actions">
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
          <div className="binary-note">二进制文件，无法显示文本差异</div>
        ) : diff.hunks.length === 0 ? (
          <div className="diff-empty">该文件没有可显示的文本改动。</div>
        ) : (
          diff.hunks.map((hunk, hunkIndex) => (
            <div key={`${hunk.header}-${hunkIndex}`}>
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

              {layout === 'unified'
                ? hunk.lines.map((line, lineIndex) => (
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
                      <span className="code">{line.content || ' '}</span>
                    </div>
                  ))
                : buildSplit(hunk.lines).map((row, rowIndex) => (
                    <div className="diff-split" key={rowIndex}>
                      <div className="half">
                        {row.left ? (
                          <div
                            className={`diff-line ${row.left.line.kind} ${
                              isSelected(hunkIndex, row.left.index) ? 'selected' : ''
                            }`}
                            onClick={() => toggleLine(hunkIndex, row.left!.index, row.left!.line)}
                          >
                            <span className="gutter">{row.left.line.oldLineNo ?? ''}</span>
                            <span className="sign">
                              {row.left.line.kind === 'del' ? '-' : ' '}
                            </span>
                            <span className="code">{row.left.line.content || ' '}</span>
                          </div>
                        ) : (
                          <div className="diff-line" style={{ background: 'var(--bg-alt)' }}>
                            <span className="gutter" />
                            <span className="sign" />
                            <span className="code" />
                          </div>
                        )}
                      </div>
                      <div className="half">
                        {row.right ? (
                          <div
                            className={`diff-line ${row.right.line.kind} ${
                              isSelected(hunkIndex, row.right.index) ? 'selected' : ''
                            }`}
                            onClick={() => toggleLine(hunkIndex, row.right!.index, row.right!.line)}
                          >
                            <span className="gutter">{row.right.line.newLineNo ?? ''}</span>
                            <span className="sign">
                              {row.right.line.kind === 'add' ? '+' : ' '}
                            </span>
                            <span className="code">{row.right.line.content || ' '}</span>
                          </div>
                        ) : (
                          <div className="diff-line" style={{ background: 'var(--bg-alt)' }}>
                            <span className="gutter" />
                            <span className="sign" />
                            <span className="code" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
