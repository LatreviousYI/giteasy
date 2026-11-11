import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDiff,
  GripHorizontal
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo, useStatus, useWorkdirDiff } from '../../lib/queries'
import { useApp } from '../../store/app'
import { Empty, Spinner } from '../../components/Empty'
import { ConfirmDialog } from '../../components/Dialogs'
import DiffViewer from '../diff/DiffViewer'
import CommitComposer from './CommitComposer'
import FileStatusTree from './FileStatusTree'
import type { FileStatus } from '../../lib/types'

const COMPOSER_MIN_HEIGHT = 170
const COMPOSER_MAX_HEIGHT = 430
const COMPOSER_DEFAULT_HEIGHT = 230

function composerStorageKey(repoId: string) {
  return `giteasy.composer.${encodeURIComponent(repoId)}`
}

function readComposerPrefs(repoId: string) {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(composerStorageKey(repoId)) ?? '{}'
    ) as { height?: number; collapsed?: boolean }
    return {
      height: Math.max(
        COMPOSER_MIN_HEIGHT,
        Math.min(COMPOSER_MAX_HEIGHT, Number(saved.height) || COMPOSER_DEFAULT_HEIGHT)
      ),
      collapsed: Boolean(saved.collapsed)
    }
  } catch {
    return { height: COMPOSER_DEFAULT_HEIGHT, collapsed: false }
  }
}

export default function ChangesView() {
  const repo = useApp((s) => s.repo)!
  const selectedFile = useApp((s) => s.selectedFile)
  const selectedStaged = useApp((s) => s.selectedFileStaged)
  const selectFile = useApp((s) => s.selectFile)
  const layout = useApp((s) => s.diffLayout)
  const setDiffLayout = useApp((s) => s.setDiffLayout)
  const ignoreWhitespace = useApp((s) => s.diffIgnoreWhitespace)
  const setIgnoreWhitespace = useApp((s) => s.setDiffIgnoreWhitespace)
  const contextLines = useApp((s) => s.diffContextLines)
  const setContextLines = useApp((s) => s.setDiffContextLines)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo.path)

  const { data: status, isLoading } = useStatus(repo.path)
  const diffQuery = useWorkdirDiff(
    repo.path,
    selectedFile,
    selectedStaged,
    ignoreWhitespace,
    contextLines
  )

  const [applying, setApplying] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<FileStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [opBusy, setOpBusy] = useState(false)
  const [composerCollapsed, setComposerCollapsed] = useState(
    () => readComposerPrefs(repo.path).collapsed
  )
  const [composerHeight, setComposerHeight] = useState(
    () => readComposerPrefs(repo.path).height
  )
  const composerRepoRef = useRef<string | null>(null)

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

  useEffect(() => {
    const prefs = readComposerPrefs(repo.path)
    composerRepoRef.current = repo.path
    setComposerHeight(prefs.height)
    setComposerCollapsed(prefs.collapsed)
  }, [repo.path])

  useEffect(() => {
    if (composerRepoRef.current !== repo.path) return
    window.localStorage.setItem(
      composerStorageKey(repo.path),
      JSON.stringify({ height: composerHeight, collapsed: composerCollapsed })
    )
  }, [repo.path, composerHeight, composerCollapsed])

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

  const startComposerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = composerHeight
    const onMove = (moveEvent: PointerEvent) => {
      setComposerHeight(
        Math.max(
          COMPOSER_MIN_HEIGHT,
          Math.min(COMPOSER_MAX_HEIGHT, startHeight + startY - moveEvent.clientY)
        )
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
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
              <FileStatusTree
                title="冲突"
                files={conflicted}
                groupStaged={false}
                selectedFile={selectedFile}
                selectedStaged={selectedStaged}
                busy={busy}
                onSelect={selectFile}
                onStage={(paths, stage) =>
                  stageFiles(paths, stage, stage ? '已暂存' : '已取消暂存')
                }
                onDiscard={setDiscardTarget}
                onResolveConflict={() => useApp.getState().setView('conflicts')}
              />
              <FileStatusTree
                title="未暂存"
                files={unstaged}
                groupStaged={false}
                actionLabel="全部暂存"
                selectedFile={selectedFile}
                selectedStaged={selectedStaged}
                busy={busy}
                onSelect={selectFile}
                onStage={(paths, stage) =>
                  stageFiles(paths, stage, stage ? '已暂存' : '已取消暂存')
                }
                onDiscard={setDiscardTarget}
                onResolveConflict={() => useApp.getState().setView('conflicts')}
              />
              <FileStatusTree
                title="已暂存"
                files={staged}
                groupStaged
                actionLabel="全部取消暂存"
                selectedFile={selectedFile}
                selectedStaged={selectedStaged}
                busy={busy}
                onSelect={selectFile}
                onStage={(paths, stage) =>
                  stageFiles(paths, stage, stage ? '已暂存' : '已取消暂存')
                }
                onDiscard={setDiscardTarget}
                onResolveConflict={() => useApp.getState().setView('conflicts')}
              />
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
          ignoreWhitespace={ignoreWhitespace}
          onToggleWhitespace={setIgnoreWhitespace}
          contextLines={contextLines}
          onContextLinesChange={setContextLines}
        />

        {composerCollapsed ? (
          <button
            className="composer-collapsed"
            onClick={() => setComposerCollapsed(false)}
          >
            <GripHorizontal size={14} />
            提交到 {repo.branch ?? 'HEAD'}
            <span>·</span>
            <span>{staged.length} 个已暂存文件</span>
            <span className="spacer" />
            <ChevronUp size={14} />
          </button>
        ) : (
          <div
            className="composer-shell"
            style={{ height: composerHeight }}
          >
            <div
              className="composer-resizer"
              onPointerDown={startComposerResize}
              title="拖动调整提交区高度"
            >
              <GripHorizontal size={13} />
            </div>
            <button
              className="composer-collapse-button"
              onClick={() => setComposerCollapsed(true)}
              title="收起提交区"
            >
              <ChevronDown size={13} />
            </button>
            <CommitComposer
              busy={busy}
              stagedCount={staged.length}
              onCommitted={() => invalidate()}
            />
          </div>
        )}
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
