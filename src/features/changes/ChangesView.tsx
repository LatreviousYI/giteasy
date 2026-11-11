import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileDiff,
  Minus,
  Plus,
  Undo2
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo, useStatus, useWorkdirDiff } from '../../lib/queries'
import { useApp } from '../../store/app'
import { splitPath, statusMeta, statusOf } from '../../lib/format'
import { Empty, Spinner } from '../../components/Empty'
import { ConfirmDialog } from '../../components/Dialogs'
import DiffViewer from '../diff/DiffViewer'
import CommitComposer from './CommitComposer'
import type { FileStatus } from '../../lib/types'

export default function ChangesView() {
  const repo = useApp((s) => s.repo)!
  const selectedFile = useApp((s) => s.selectedFile)
  const selectedStaged = useApp((s) => s.selectedFileStaged)
  const selectFile = useApp((s) => s.selectFile)
  const layout = useApp((s) => s.diffLayout)
  const setDiffLayout = useApp((s) => s.setDiffLayout)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo.path)

  const { data: status, isLoading } = useStatus(repo.path)
  const diffQuery = useWorkdirDiff(repo.path, selectedFile, selectedStaged)

  const [applying, setApplying] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<FileStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [opBusy, setOpBusy] = useState(false)

  const files = status?.files ?? []
  const conflicted = useMemo(() => files.filter((file) => file.conflicted), [files])
  const unstaged = useMemo(
    () => files.filter((file) => !file.conflicted && file.unstaged),
    [files]
  )
  const staged = useMemo(
    () => files.filter((file) => !file.conflicted && file.staged),
    [files]
  )

  useEffect(() => {
    if (!status) return
    if (selectedFile && files.some((file) => file.path === selectedFile)) return
    const first = conflicted[0] ?? unstaged[0] ?? staged[0]
    if (first) selectFile(first.path, !first.unstaged && first.staged)
    else selectFile(null)
  }, [status, files, conflicted, unstaged, staged, selectedFile, selectFile])

  const currentFile = files.find((file) => file.path === selectedFile)
  const relevantState = currentFile
    ? selectedStaged
      ? currentFile.index
      : currentFile.worktree
    : 'unmodified'
  const canPartial =
    !currentFile?.conflicted &&
    (relevantState === 'modified' ||
      (!selectedStaged && (relevantState === 'untracked' || relevantState === 'added')))

  const stageFiles = async (paths: string[], stage: boolean, message: string) => {
    if (paths.length === 0) return
    setBusy(true)
    try {
      await ipc.stagePaths(repo.path, paths, stage)
      invalidate()
      toast('success', message)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const discard = async () => {
    if (!discardTarget) return
    setBusy(true)
    try {
      await ipc.discardPaths(repo.path, [discardTarget.path])
      invalidate()
      toast('success', '已丢弃该文件的改动')
      setDiscardTarget(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const applySelection = async (
    selections: { hunk: number; lines: number[] }[],
    mode: 'stage' | 'unstage'
  ) => {
    if (!selectedFile) return
    setApplying(true)
    try {
      await ipc.applySelection(repo.path, selectedFile, mode, selections)
      invalidate()
      toast('success', mode === 'stage' ? '已暂存选中的改动' : '已取消暂存选中的改动')
    } catch (error) {
      errorToast(error)
    } finally {
      setApplying(false)
    }
  }

  const continueOperation = async () => {
    if (!status || status.state === 'clean') return
    setOpBusy(true)
    try {
      await ipc.opContinue(repo.path, status.state)
      invalidate()
      toast('success', '操作已继续')
    } catch (error) {
      errorToast(error)
    } finally {
      setOpBusy(false)
    }
  }

  const abortOperation = async () => {
    if (!status || status.state === 'clean') return
    setOpBusy(true)
    try {
      await ipc.opAbort(repo.path, status.state)
      invalidate()
      toast('success', '已中止操作')
    } catch (error) {
      errorToast(error)
    } finally {
      setOpBusy(false)
    }
  }

  const renderGroup = (
    title: string,
    groupFiles: FileStatus[],
    groupStaged: boolean,
    actionLabel?: string
  ) => {
    if (groupFiles.length === 0) return null
    return (
      <div>
        <div className="group-head">
          <span>{title}</span>
          <span className="count">{groupFiles.length}</span>
          <span className="spacer" />
          {actionLabel && (
            <button
              disabled={busy}
              onClick={() =>
                stageFiles(
                  groupFiles.map((file) => file.path),
                  !groupStaged,
                  groupStaged ? '已全部取消暂存' : '已全部暂存'
                )
              }
            >
              {actionLabel}
            </button>
          )}
        </div>
        {groupFiles.map((file) => {
          const meta = statusMeta[statusOf(file)] ?? statusMeta.modified
          const { name, dir } = splitPath(file.path)
          const active = selectedFile === file.path && selectedStaged === groupStaged
          return (
            <div
              key={`${groupStaged}-${file.path}`}
              className={`file-row ${active ? 'active' : ''}`}
              onClick={() => selectFile(file.path, groupStaged)}
            >
              <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
              <div className="file-row-main">
                <div className="file-label">
                  <span className="file-name">{name}</span>
                  {dir && <span className="file-dir">{dir}</span>}
                </div>
              </div>
              <div className="file-actions">
                {file.conflicted ? (
                  <button
                    className="icon-btn"
                    title="去解决冲突"
                    onClick={(event) => {
                      event.stopPropagation()
                      useApp.getState().setView('conflicts')
                    }}
                  >
                    <AlertTriangle size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      className="icon-btn"
                      title={groupStaged ? '取消暂存' : '暂存'}
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation()
                        stageFiles(
                          [file.path],
                          !groupStaged,
                          groupStaged ? '已取消暂存' : '已暂存'
                        )
                      }}
                    >
                      {groupStaged ? <Minus size={14} /> : <Plus size={14} />}
                    </button>
                    <button
                      className="icon-btn"
                      title="丢弃改动"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDiscardTarget(file)
                      }}
                    >
                      <Undo2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="content">
      <section className="file-panel">
        <div className="panel-head">
          <FileDiff size={13} />
          工作区变更
          <span className="spacer" />
          {busy && <Spinner />}
        </div>
        <div className="scroll-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : files.length === 0 ? (
            <div className="empty" style={{ paddingTop: 60 }}>
              <div className="empty-icon">
                <CheckCircle2 size={22} className="add-text" />
              </div>
              <div className="empty-title">工作区干净</div>
              <div className="empty-sub">没有未提交的改动，可以安心开始新的修改。</div>
            </div>
          ) : (
            <>
              {renderGroup('冲突', conflicted, false)}
              {renderGroup('未暂存', unstaged, false, '全部暂存')}
              {renderGroup('已暂存', staged, true, '全部取消暂存')}
            </>
          )}
        </div>
      </section>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {status && status.state !== 'clean' && (
          <div className="conflict-banner">
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>
              仓库处于 <b>{status.state}</b> 状态，解决冲突后可继续或中止操作。
            </span>
            <button className="btn btn-sm" onClick={continueOperation} disabled={opBusy}>
              继续
            </button>
            <button className="btn btn-sm btn-danger" onClick={abortOperation} disabled={opBusy}>
              中止
            </button>
          </div>
        )}

        <DiffViewer
          diff={diffQuery.data}
          loading={diffQuery.isLoading}
          layout={layout}
          onLayoutChange={setDiffLayout}
          actionMode={canPartial ? (selectedStaged ? 'unstage' : 'stage') : undefined}
          onApply={
            canPartial
              ? (selections) =>
                  applySelection(selections, selectedStaged ? 'unstage' : 'stage')
              : undefined
          }
          applying={applying}
        />

        <CommitComposer
          busy={busy}
          stagedCount={staged.length}
          onCommitted={() => invalidate()}
        />
      </div>

      <ConfirmDialog
        open={!!discardTarget}
        title="丢弃改动"
        danger
        confirmLabel="丢弃"
        busy={busy}
        message={
          discardTarget && (
            <div>
              <p style={{ marginTop: 0 }}>
                将丢弃 <span className="mono">{discardTarget.path}</span> 的未提交改动，
                该操作不可撤销。
              </p>
              <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
                建议先将其储藏（Stash）以便日后恢复。
              </p>
            </div>
          )
        }
        onCancel={() => setDiscardTarget(null)}
        onConfirm={discard}
      />
    </div>
  )
}
