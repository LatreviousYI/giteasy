import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  GitCommitHorizontal,
  GripVertical,
  ListOrdered,
  RefreshCw
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Spinner } from '../../components/Empty'
import type { ProgressEvent, RebaseAction, RebaseCommit, RebaseStep } from '../../lib/types'

const ACTIONS: { value: RebaseAction; label: string; hint: string }[] = [
  { value: 'pick', label: 'pick 保留', hint: '保留该提交' },
  { value: 'reword', label: 'reword 改写信息', hint: '保留改动，修改提交信息' },
  { value: 'squash', label: 'squash 合并', hint: '合并到上一个提交，保留双方信息' },
  { value: 'fixup', label: 'fixup 合并', hint: '合并到上一个提交，丢弃本条信息' },
  { value: 'drop', label: 'drop 丢弃', hint: '删除该提交' }
]

interface StepState extends RebaseCommit {
  action: RebaseAction
  message: string
  originalSubject: string
}

export default function RebaseDialog({
  base,
  baseSubject,
  onClose
}: {
  base: string
  baseSubject?: string
  onClose: () => void
}) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)

  const [steps, setSteps] = useState<StepState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)

  const load = async () => {
    if (!repo) return
    setLoadError(null)
    setSteps(null)
    try {
      const commits = await ipc.rebaseTodo(repo.path, base)
      setSteps(
        commits.map((commit) => ({
          ...commit,
          action: 'pick',
          message: commit.subject,
          originalSubject: commit.subject
        }))
      )
    } catch (error) {
      setLoadError((error as { message?: string })?.message ?? '读取提交列表失败')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, repo?.path])

  if (!repo) return null

  const update = (index: number, patch: Partial<StepState>) => {
    setSteps((prev) =>
      prev ? prev.map((step, i) => (i === index ? { ...step, ...patch } : step)) : prev
    )
  }

  const move = (index: number, delta: number) => {
    setSteps((prev) => {
      if (!prev) return prev
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const start = async () => {
    if (!steps || busy) return
    const payload: RebaseStep[] = steps.map((step) => ({
      action: step.action,
      oid: step.oid,
      message: step.action === 'reword' ? step.message : null
    }))
    setBusy(true)
    setProgress(null)
    try {
      await ipc.rebaseStart(repo.path, base, payload, (event) => setProgress(event))
      invalidate()
      toast('success', '交互式变基完成')
      onClose()
    } catch (error) {
      setProgress(null)
      errorToast(error)
      if ((error as { kind?: string })?.kind === 'conflict') {
        invalidate()
        useApp.getState().setView('conflicts')
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  const firstActive = steps?.find((step) => step.action !== 'drop')
  const canStart = !!steps && steps.length > 0 && !busy

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <ListOrdered size={15} />
          交互式变基
        </span>
      }
      onClose={onClose}
      wide
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={start} disabled={!canStart}>
            {busy ? '变基中…' : '开始变基'}
          </button>
        </>
      }
    >
      <div className="text-[12px] text-[var(--text-muted)]">
        变基基点 <span className="mono">{base.slice(0, 8)}</span>
        {baseSubject ? `（${baseSubject}）` : ''}，以下提交将按顺序重放到该基点之上。
      </div>
      <div className="text-[11px] text-[var(--text-subtle)]">
        请先提交或储藏工作区改动；变基过程中产生冲突时会自动切换到「冲突」视图。
      </div>

      {loadError ? (
        <div className="flex items-center gap-2 text-[12px] danger-text">
          <span style={{ flex: 1 }}>{loadError}</span>
          <button className="btn btn-sm" onClick={load}>
            <RefreshCw size={12} />
            重试
          </button>
        </div>
      ) : !steps ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : steps.length === 0 ? (
        <div className="text-[12px] text-[var(--text-subtle)]">
          该提交就是当前 HEAD，没有需要重放的提交。
        </div>
      ) : (
        <div className="rebase-list">
          {steps.map((step, index) => {
            const isFirstActive = firstActive === step
            return (
              <div key={step.oid} className="rebase-row">
                <div className="rebase-row-main">
                  <GripVertical size={13} className="text-subtle" />
                  <span className="rebase-index">{index + 1}</span>
                  <select
                    className="select rebase-action"
                    value={step.action}
                    disabled={busy}
                    onChange={(event) =>
                      update(index, { action: event.target.value as RebaseAction })
                    }
                  >
                    {ACTIONS.map((action) => (
                      <option
                        key={action.value}
                        value={action.value}
                        disabled={
                          isFirstActive &&
                          (action.value === 'squash' || action.value === 'fixup')
                        }
                      >
                        {action.label}
                      </option>
                    ))}
                  </select>
                  <span className="mono text-[11px] text-[var(--text-subtle)]">
                    {step.shortOid}
                  </span>
                  <span
                    className={`truncate rebase-subject ${
                      step.action === 'drop' ? 'line-through opacity-60' : ''
                    }`}
                    title={step.originalSubject}
                  >
                    {step.originalSubject || '(无提交信息)'}
                  </span>
                  <button
                    className="icon-btn"
                    title="上移"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    className="icon-btn"
                    title="下移"
                    disabled={busy || index === steps.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                {step.action === 'reword' && (
                  <textarea
                    className="textarea rebase-message"
                    value={step.message}
                    placeholder="输入新的提交信息"
                    disabled={busy}
                    onChange={(event) => update(index, { message: event.target.value })}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {steps && steps.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-subtle)]">
          <GitCommitHorizontal size={12} />
          <span>
            共 {steps.length} 个提交，保留 {steps.filter((step) => step.action !== 'drop').length}{' '}
            个
          </span>
        </div>
      )}

      {progress && (
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
          <span>{progress.phase}</span>
          {progress.percent !== null && (
            <span className="progress-track">
              <span
                className="progress-fill block"
                style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
              />
            </span>
          )}
          <span className="truncate">{progress.message}</span>
        </div>
      )}
    </Modal>
  )
}
