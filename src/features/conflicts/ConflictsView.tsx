import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileWarning, GitMerge } from 'lucide-react'
import { Empty, Spinner } from '../../components/Empty'
import { ipc } from '../../lib/ipc'
import { parseConflictBlocks } from '../../lib/conflict'
import { useConflicts, useInvalidateRepo, useStatus } from '../../lib/queries'
import { useApp } from '../../store/app'
import ConflictMergeEditor from './ConflictMergeEditor'
import { unresolvedConflictCount } from './conflictSessions'
import { useConflictSessions } from './useConflictSessions'

export default function ConflictsView() {
  const repo = useApp((state) => state.repo)!
  const toast = useApp((state) => state.toast)
  const errorToast = useApp((state) => state.errorToast)
  const invalidate = useInvalidateRepo(repo.path)
  const { data: conflicts = [], isLoading } = useConflicts(repo.path)
  const { data: status } = useStatus(repo.path)
  const {
    sessions,
    navigate,
    applyChoice,
    applyAll,
    beginEdit,
    updateContent,
    endEdit,
    undo,
    remove
  } = useConflictSessions(conflicts)

  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (conflicts.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !conflicts.some((file) => file.path === selected)) {
      setSelected(conflicts[0].path)
    }
  }, [conflicts, selected])

  const current = conflicts.find((file) => file.path === selected) ?? null
  const session = current ? (sessions[current.path] ?? null) : null

  const selectFile = (path: string) => {
    if (selected && selected !== path) endEdit(selected)
    setSelected(path)
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      invalidate()
      toast('success', success)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const resolveCurrent = async () => {
    if (!current || !session) return
    if (!current.binary && unresolvedConflictCount(session.content) > 0) return
    setBusy(true)
    try {
      await ipc.conflictResolve(repo.path, current.path, session.content)
      remove(current.path)
      invalidate()
      toast('success', '已标记为已解决')
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const openExternal = async () => {
    if (!current) return
    try {
      await ipc.openInEditor(repo.path, current.path)
    } catch (error) {
      errorToast(error)
    }
  }

  return (
    <div className="content">
      <section className="file-panel" style={{ width: 268, flex: '0 0 268px' }}>
        <div className="panel-head">
          <FileWarning size={13} />
          冲突文件
          <span className="spacer" />
          <span className="row-sub">{conflicts.length}</span>
        </div>
        <div className="scroll-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="empty" style={{ paddingTop: 50 }}>
              <div className="empty-icon">
                <CheckCircle2 size={22} className="add-text" />
              </div>
              <div className="empty-title">没有冲突</div>
              <div className="empty-sub">当前仓库没有待解决的冲突文件。</div>
            </div>
          ) : (
            conflicts.map((file) => {
              const fileSession = sessions[file.path]
              const total = fileSession?.blocks.length ?? parseConflictBlocks(file.result).length
              const remaining = fileSession
                ? unresolvedConflictCount(fileSession.content)
                : parseConflictBlocks(file.result).length
              return (
                <div
                  key={file.path}
                  className={`file-row ${selected === file.path ? 'active' : ''}`}
                  onClick={() => selectFile(file.path)}
                >
                  <span className="file-letter st-conflicted">!</span>
                  <div className="file-row-main">
                    <div className="file-label">
                      <span className="file-name">{file.path}</span>
                    </div>
                  </div>
                  {total > 0 && (
                    <span className="conflict-file-progress">
                      {total - remaining}/{total}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <div className="conflict-pane">
        {status && status.state !== 'clean' && (
          <div className="conflict-banner">
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>
              正在 <b>{status.state}</b>。解决全部冲突并标记后，可继续完成操作。
            </span>
            <button
              className="btn btn-sm"
              onClick={() => void run(() => ipc.opContinue(repo.path, status.state), '操作已继续')}
              disabled={busy}
            >
              继续
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => void run(() => ipc.opAbort(repo.path, status.state), '已中止操作')}
              disabled={busy}
            >
              中止
            </button>
          </div>
        )}

        {!current ? (
          <Empty
            icon={<GitMerge size={20} />}
            title={status?.state && status.state !== 'clean' ? '等待冲突文件' : '没有进行中的合并'}
            subtitle={
              status?.state && status.state !== 'clean'
                ? '所有冲突都已解决，可以继续操作。'
                : '当合并、变基或拣选产生冲突时，这里会列出需要处理的文件。'
            }
          />
        ) : !session ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ConflictMergeEditor
            file={current}
            session={session}
            busy={busy}
            onNavigate={(direction) => navigate(current.path, direction)}
            onApplyChoice={(choice) => applyChoice(current.path, choice)}
            onApplyAll={(choice) => applyAll(current.path, choice)}
            onBeginEdit={() => beginEdit(current.path)}
            onUpdateContent={(content) => updateContent(current.path, content)}
            onEndEdit={() => endEdit(current.path)}
            onUndo={() => undo(current.path)}
            onOpenExternal={() => void openExternal()}
            onResolve={() => void resolveCurrent()}
          />
        )}
      </div>
    </div>
  )
}
