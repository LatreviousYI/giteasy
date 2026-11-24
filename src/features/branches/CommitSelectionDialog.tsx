import { useMemo, useState } from 'react'
import { GitCommitHorizontal } from 'lucide-react'
import Modal from '../../components/Modal'
import { relativeTime } from '../../lib/format'
import { useLog } from '../../lib/queries'
import type { CommitDto } from '../../lib/types'

export type CommitSelectionMode = 'cherry-pick' | 'revert'

interface CommitSelectionDialogProps {
  repoPath: string
  mode: CommitSelectionMode
  sourceRef: string
  sourceLabel: string
  currentBranch: string
  busy: boolean
  onCancel: () => void
  onSubmit: (oids: string[]) => void
}

const INITIAL_LIMIT = 200
const MAX_SELECTION = 100

function isMergeCommit(commit: CommitDto) {
  return commit.parents.length > 1
}

export default function CommitSelectionDialog({
  repoPath,
  mode,
  sourceRef,
  sourceLabel,
  currentBranch,
  busy,
  onCancel,
  onSubmit
}: CommitSelectionDialogProps) {
  const [limit, setLimit] = useState(INITIAL_LIMIT)
  const [selected, setSelected] = useState<string[]>([])
  const query = useMemo(
    () => ({
      rev: mode === 'cherry-pick' ? `HEAD..${sourceRef}` : 'HEAD',
      limit,
      skip: 0,
      reverse: mode === 'cherry-pick'
    }),
    [limit, mode, sourceRef]
  )
  const { data, isLoading } = useLog(repoPath, query)
  const commits = data?.commits ?? []
  const selectedSet = new Set(selected)
  const orderedSelection = commits
    .filter((commit) => selectedSet.has(commit.oid) && !isMergeCommit(commit))
    .map((commit) => commit.oid)

  const toggle = (commit: CommitDto) => {
    if (isMergeCommit(commit) || busy) return
    setSelected((current) => {
      if (current.includes(commit.oid)) {
        return current.filter((oid) => oid !== commit.oid)
      }
      if (current.length >= MAX_SELECTION) return current
      return [...current, commit.oid]
    })
  }

  const title = mode === 'cherry-pick' ? 'Cherry-pick 提交到当前分支' : '回滚当前分支提交'
  const description =
    mode === 'cherry-pick'
      ? `从 ${sourceLabel} 选择提交，按从旧到新的顺序应用到 ${currentBranch}。`
      : `从 ${currentBranch} 选择提交，按从新到旧的顺序创建反向提交。`

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <GitCommitHorizontal size={15} />
          {title}
        </span>
      }
      onClose={onCancel}
      wide
      footer={
        <>
          <span className="text-[11px] text-[var(--text-subtle)]">
            已选择 {selected.length} / {MAX_SELECTION}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => orderedSelection.length > 0 && onSubmit(orderedSelection)}
            disabled={busy || orderedSelection.length === 0}
          >
            {busy
              ? '处理中…'
              : mode === 'cherry-pick'
                ? `Cherry-pick ${orderedSelection.length} 个提交`
                : `回滚 ${orderedSelection.length} 个提交`}
          </button>
        </>
      }
    >
      <div className="text-[12px] text-[var(--text-muted)] mb-3">{description}</div>
      <div className="commit-selection-list">
        {isLoading ? (
          <div className="p-4 text-center text-[12px] text-[var(--text-subtle)]">正在读取提交…</div>
        ) : commits.length === 0 ? (
          <div className="p-4 text-center text-[12px] text-[var(--text-subtle)]">
            没有可选择的提交
          </div>
        ) : (
          commits.map((commit) => {
            const merge = isMergeCommit(commit)
            const checked = selectedSet.has(commit.oid)
            const limitReached = selected.length >= MAX_SELECTION && !checked
            return (
              <label
                key={commit.oid}
                className={`commit-selection-row ${merge ? 'disabled' : ''}`}
                title={merge ? '暂不支持对 Merge 提交执行此操作' : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy || merge || limitReached}
                  onChange={() => toggle(commit)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">{commit.subject}</span>
                  <span className="commit-meta">
                    <span>{commit.authorName}</span>
                    <span>{relativeTime(commit.time)}</span>
                    <span className="mono">{commit.shortOid}</span>
                    {merge && <span>Merge 提交不可选</span>}
                  </span>
                </span>
              </label>
            )
          })
        )}
      </div>
      {data?.hasMore && (
        <div className="mt-2">
          <button className="btn btn-sm w-full" onClick={() => setLimit((value) => value + 200)}>
            加载更多提交
          </button>
        </div>
      )}
    </Modal>
  )
}
