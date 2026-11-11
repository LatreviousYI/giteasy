import { useEffect, useState } from 'react'
import {
  Copy,
  ChevronDown,
  GitBranch,
  GitCommitHorizontal,
  ListOrdered,
  MoreHorizontal,
  RotateCcw,
  Undo2
} from 'lucide-react'
import { useCommitDetail, useCommitDiff } from '../../lib/queries'
import {
  laneColor,
  LANE_COLORS,
  type GraphRow
} from '../../lib/graph'
import { formatDate, initials, relativeTime } from '../../lib/format'
import type { CommitDto } from '../../lib/types'
import { Spinner } from '../../components/Empty'
import DiffViewer from '../diff/DiffViewer'
import CommitTreePane from './CommitTreePane'
import CommitFileTree from './CommitFileTree'

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
  onReset
}: CommitDetailPaneProps) {
  const { data: detail, isLoading } = useCommitDetail(repoPath, oid)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'changes' | 'tree'>('changes')
  const [actionsOpen, setActionsOpen] = useState(false)
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
    setActionsOpen(false)
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
        <div className="detail-toolbar">
          <div className="seg">
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
          <span className="spacer" />
          <button className="btn btn-sm" onClick={onCheckout} disabled={busy}>
            <GitBranch size={13} />
            检出
          </button>
          <button className="btn btn-sm" onClick={onCherryPick} disabled={busy}>
            <GitCommitHorizontal size={13} />
            拣选
          </button>
          <div className="relative">
            <button
              className="btn btn-sm"
              onClick={() => setActionsOpen((open) => !open)}
              disabled={busy}
            >
              <MoreHorizontal size={14} />
              更多
              <ChevronDown size={12} />
            </button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} />
                <div className="detail-actions-menu">
                  <button
                    onClick={() => {
                      setActionsOpen(false)
                      onRevert()
                    }}
                  >
                    <Undo2 size={13} />
                    回滚提交
                  </button>
                  <button
                    onClick={() => {
                      setActionsOpen(false)
                      onRebase()
                    }}
                  >
                    <ListOrdered size={13} />
                    从此提交后交互式变基
                  </button>
                  <div className="detail-actions-separator" />
                  <div className="detail-actions-label">重置当前分支</div>
                  {(['soft', 'mixed', 'hard'] as const).map((mode) => (
                    <button
                      key={mode}
                      className={mode === 'hard' ? 'danger-text' : ''}
                      onClick={() => {
                        setActionsOpen(false)
                        onReset(mode)
                      }}
                    >
                      <RotateCcw size={13} />
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
          <CommitFileTree
            files={detail.files}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />

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
            compactToolbar
          />
        </>
      ) : (
        <CommitTreePane repoPath={repoPath} rev={oid} />
      )}
    </>
  )
}
