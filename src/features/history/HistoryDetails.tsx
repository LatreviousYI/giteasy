import { useEffect, useState } from 'react'
import {
  Copy,
  GitBranch,
  GitCommitHorizontal,
  ListOrdered,
  RotateCcw,
  Undo2
} from 'lucide-react'
import { useCommitDetail, useCommitDiff } from '../../lib/queries'
import {
  laneColor,
  LANE_COLORS,
  type GraphRow
} from '../../lib/graph'
import { formatDate, initials, relativeTime, statusMeta } from '../../lib/format'
import type { CommitDto } from '../../lib/types'
import { Spinner } from '../../components/Empty'
import DiffViewer from '../diff/DiffViewer'
import CommitTreePane from './CommitTreePane'

export function GraphCell({ row }: { row: GraphRow }) {
  const width = row.laneCount * 14 + 10
  const height = 40
  const x = (lane: number) => 8 + lane * 14
  const passing = row.before
    .map((oid, index) => ({ oid, index }))
    .filter(
      (item) => item.oid && row.after[item.index] === item.oid && item.index !== row.lane
    )

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {passing.map((item) => (
        <line
          key={`p-${item.index}`}
          x1={x(item.index)}
          y1={0}
          x2={x(item.index)}
          y2={height}
          stroke={LANE_COLORS[laneColor(item.oid as string)]}
          strokeWidth={2}
          opacity={0.75}
        />
      ))}
      <line
        x1={x(row.lane)}
        y1={0}
        x2={x(row.lane)}
        y2={20}
        stroke={LANE_COLORS[row.color]}
        strokeWidth={2}
        opacity={0.85}
      />
      {row.edges.map((edge, index) =>
        edge.from === edge.to ? (
          <line
            key={`e-${index}`}
            x1={x(edge.from)}
            y1={20}
            x2={x(edge.to)}
            y2={height}
            stroke={LANE_COLORS[edge.color]}
            strokeWidth={2}
            opacity={0.9}
          />
        ) : (
          <path
            key={`e-${index}`}
            d={`M ${x(edge.from)} 20 C ${x(edge.from)} 28 ${x(edge.to)} 30 ${x(edge.to)} ${height}`}
            fill="none"
            stroke={LANE_COLORS[edge.color]}
            strokeWidth={2}
            opacity={edge.merge ? 0.85 : 1}
          />
        )
      )}
      <circle
        cx={x(row.lane)}
        cy={20}
        r={4.5}
        fill={LANE_COLORS[row.color]}
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  )
}

interface CommitDetailPaneProps {
  repoPath: string
  oid: string
  layout: 'unified' | 'split'
  onLayoutChange: (layout: 'unified' | 'split') => void
  busy: boolean
  ignoreWhitespace: boolean
  onToggleWhitespace: (value: boolean) => void
  contextLines: number
  onContextLinesChange: (value: number) => void
  onCheckout: () => void
  onCherryPick: () => void
  onRevert: () => void
  onRebase: () => void
  onCopy: () => void
  onReset: (mode: 'soft' | 'mixed' | 'hard') => void
  resetMenuOpen: boolean
  setResetMenuOpen: (open: boolean) => void
}

export function CommitDetailPane({
  repoPath,
  oid,
  layout,
  onLayoutChange,
  busy,
  ignoreWhitespace,
  onToggleWhitespace,
  contextLines,
  onContextLinesChange,
  onCheckout,
  onCherryPick,
  onRevert,
  onRebase,
  onCopy,
  onReset,
  resetMenuOpen,
  setResetMenuOpen
}: CommitDetailPaneProps) {
  const { data: detail, isLoading } = useCommitDetail(repoPath, oid)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'changes' | 'tree'>('changes')
  const diffQuery = useCommitDiff(
    repoPath,
    oid,
    selectedPath,
    ignoreWhitespace,
    contextLines
  )

  useEffect(() => {
    if (detail) setSelectedPath(detail.files[0]?.path ?? null)
    setDetailTab('changes')
  }, [detail?.commit.oid])

  if (isLoading || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const commit: CommitDto = detail.commit

  return (
    <>
      <div className="detail-head">
        <div className="flex items-start gap-2">
          <h2 className="detail-title" style={{ flex: 1 }}>
            {commit.subject || '(无提交信息)'}
          </h2>
          <button className="icon-btn" title="复制完整哈希" onClick={onCopy}>
            <Copy size={14} />
          </button>
        </div>
        {commit.body && commit.body !== commit.subject && (
          <div
            className="text-[12px] text-[var(--text-muted)] mb-2"
            style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}
          >
            {commit.body}
          </div>
        )}
        <div className="detail-meta">
          <span className="avatar">{initials(commit.authorName)}</span>
          <span>{commit.authorName}</span>
          <span>·</span>
          <span title={formatDate(commit.time)}>{relativeTime(commit.time)}</span>
          <span className="oid-chip mono" onClick={onCopy} title="点击复制完整哈希">
            {commit.shortOid}
          </span>
          {commit.refs.map((ref) => (
            <span key={`${ref.kind}-${ref.name}`} className={`ref-chip ref-${ref.kind}`}>
              {ref.name}
            </span>
          ))}
        </div>
        <div className="seg" style={{ width: 'fit-content', marginTop: 10 }}>
          <button
            className={detailTab === 'changes' ? 'active' : ''}
            onClick={() => setDetailTab('changes')}
          >
            Changes
          </button>
          <button
            className={detailTab === 'tree' ? 'active' : ''}
            onClick={() => setDetailTab('tree')}
          >
            File Tree
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button className="btn btn-sm" onClick={onCheckout} disabled={busy}>
            <GitBranch size={13} />
            检出
          </button>
          <button className="btn btn-sm" onClick={onCherryPick} disabled={busy}>
            <GitCommitHorizontal size={13} />
            拣选
          </button>
          <button className="btn btn-sm" onClick={onRevert} disabled={busy}>
            <Undo2 size={13} />
            回滚
          </button>
          <button
            className="btn btn-sm"
            onClick={onRebase}
            disabled={busy}
            title="从这个提交之后开始交互式变基"
          >
            <ListOrdered size={13} />
            交互式变基…
          </button>
          <div className="relative">
            <button
              className="btn btn-sm"
              onClick={() => setResetMenuOpen(!resetMenuOpen)}
              disabled={busy}
            >
              <RotateCcw size={13} />
              重置…
            </button>
            {resetMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setResetMenuOpen(false)} />
                <div
                  className="absolute left-0 top-[30px] z-40 min-w-[180px] rounded-[10px] p-1.5"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-pop)'
                  }}
                >
                  {(['soft', 'mixed', 'hard'] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--surface-hover)] text-[12px] ${
                        mode === 'hard' ? 'danger-text' : ''
                      }`}
                      onClick={() => {
                        setResetMenuOpen(false)
                        onReset(mode)
                      }}
                    >
                      重置到此处（{mode}）
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {detailTab === 'changes' ? (
        <>
          <div className="detail-files">
            {detail.files.length === 0 && (
              <div className="px-2 py-2 text-[12px] text-[var(--text-subtle)]">
                该提交没有文件改动
              </div>
            )}
            {detail.files.map((file) => {
              const meta = statusMeta[file.status] ?? statusMeta.modified
              return (
                <div
                  key={file.path}
                  className={`detail-file ${selectedPath === file.path ? 'active' : ''}`}
                  onClick={() => setSelectedPath(file.path)}
                  title={file.path}
                >
                  <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
                  <span className="path">{file.path}</span>
                  {file.binary ? (
                    <span className="text-subtle text-[10px]">binary</span>
                  ) : (
                    <>
                      <span className="add-count">+{file.additions}</span>
                      <span className="del-count">-{file.deletions}</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <DiffViewer
            diff={diffQuery.data}
            loading={diffQuery.isLoading}
            layout={layout}
            onLayoutChange={onLayoutChange}
            ignoreWhitespace={ignoreWhitespace}
            onToggleWhitespace={onToggleWhitespace}
            contextLines={contextLines}
            onContextLinesChange={onContextLinesChange}
            imageSource={{ kind: 'commit', left: oid }}
          />
        </>
      ) : (
        <CommitTreePane repoPath={repoPath} rev={oid} />
      )}
    </>
  )
}
