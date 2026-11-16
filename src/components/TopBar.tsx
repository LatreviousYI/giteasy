import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Command,
  Download,
  FolderOpen,
  Github,
  FileDown,
  HardDrive,
  Wrench,
  Plus,
  RefreshCw,
  Settings,
  Terminal,
  X
} from 'lucide-react'
import { ipc } from '../lib/ipc'
import { useRemoteActions } from '../lib/remote'
import { pullModeLabel } from '../lib/pull'
import { useApp } from '../store/app'
import { useUpdates } from '../store/updates'
import type { PullMode, StatusDto } from '../lib/types'
import { ConfirmDialog } from './Dialogs'
import { pickDirectory, useOpenRepo } from '../lib/actions'

const PULL_MODES: Array<{ mode: PullMode; title: string; hint: string }> = [
  {
    mode: 'auto',
    title: '使用仓库记忆',
    hint: '未设置时自动合并；首次分叉会询问'
  },
  { mode: 'merge', title: '拉取并合并', hint: '保留本地提交并创建合并提交' },
  { mode: 'rebase', title: '拉取并变基', hint: '把本地提交重放到远端提交之后' },
  { mode: 'ff-only', title: '仅允许快进', hint: '无法快进时停止，不创建提交' }
]

export default function TopBar({ status }: { status?: StatusDto }) {
  const repo = useApp((s) => s.repo)
  const workspaceTabs = useApp((s) => s.workspaceTabs)
  const repos = useApp((s) => s.repos)
  const activateRepoWorkspace = useApp((s) => s.activateRepoWorkspace)
  const closeRepoWorkspace = useApp((s) => s.closeRepoWorkspace)
  const reorderRepoWorkspace = useApp((s) => s.reorderRepoWorkspace)
  const progress = useApp((s) => s.progress)
  const setPaletteOpen = useApp((s) => s.setPaletteOpen)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const setActivityOpen = useApp((s) => s.setActivityOpen)
  const setGithubOpen = useApp((s) => s.setGithubOpen)
  const setPatchOpen = useApp((s) => s.setPatchOpen)
  const setLfsOpen = useApp((s) => s.setLfsOpen)
  const setToolsOpen = useApp((s) => s.setToolsOpen)
  const errorToast = useApp((s) => s.errorToast)
  const openRepo = useOpenRepo()
  const { runRemote, remotes } = useRemoteActions()
  const savedPullStrategy = useApp((state) =>
    state.repo ? state.repoStates[state.repo.path]?.pullStrategy ?? null : null
  )
  const updateAvailable = useUpdates((state) => state.status === 'available')
  const availableVersion = useUpdates((state) => state.availableVersion)
  const [busy, setBusy] = useState<string | null>(null)
  const [pushMenuOpen, setPushMenuOpen] = useState(false)
  const [pullMenuOpen, setPullMenuOpen] = useState(false)
  const [forceConfirm, setForceConfirm] = useState(false)
  const [draggingTab, setDraggingTab] = useState<string | null>(null)
  const pushMenuRef = useRef<HTMLDivElement>(null)
  const pullMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (pushMenuRef.current && !pushMenuRef.current.contains(event.target as Node)) {
        setPushMenuOpen(false)
      }
      if (pullMenuRef.current && !pullMenuRef.current.contains(event.target as Node)) {
        setPullMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleRemote = async (
    kind: 'fetch' | 'pull' | 'push',
    force = false,
    remote?: string,
    pullMode: PullMode = 'auto'
  ) => {
    if (busy) return
    setBusy(kind)
    setPushMenuOpen(false)
    setPullMenuOpen(false)
    await runRemote(kind, force, remote, pullMode)
    setBusy(null)
    setForceConfirm(false)
  }

  const openTerminal = async () => {
    if (!repo) return
    try {
      await ipc.openInTerminal(repo.path)
    } catch (error) {
      errorToast(error)
    }
  }

  const addWorkspace = async () => {
    const path = await pickDirectory('打开 Git 仓库')
    if (path) await openRepo(path)
  }

  const closeWorkspace = async (repoId: string) => {
    try {
      await ipc.repoClose(repoId)
    } catch (error) {
      errorToast(error)
    } finally {
      closeRepoWorkspace(repoId)
    }
  }

  return (
    <header className="topbar workspace-topbar">
      <div className="topbar-tabs">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>GitEasy</span>
        </div>
        <div className="repo-tabs-scroll" role="tablist" aria-label="打开的仓库">
          {workspaceTabs.map((repoId) => {
            const tab = repos[repoId]
            if (!tab) return null
            const active = repo?.path === repoId
            return (
              <div
                key={repoId}
                className={`repo-tab ${active ? 'active' : ''}`}
                role="tab"
                aria-selected={active}
                title={repoId}
                onClick={() => activateRepoWorkspace(repoId)}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    void closeWorkspace(repoId)
                  }
                }}
                draggable
                onDragStart={() => setDraggingTab(repoId)}
                onDragEnd={() => setDraggingTab(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!draggingTab) return
                  reorderRepoWorkspace(
                    workspaceTabs.indexOf(draggingTab),
                    workspaceTabs.indexOf(repoId)
                  )
                  setDraggingTab(null)
                }}
              >
                <span className="repo-tab-main">
                  <span className="repo-tab-name">{tab.name}</span>
                  <span className="repo-tab-branch">
                    {tab.branch ?? tab.headShort ?? 'detached'}
                  </span>
                </span>
                <button
                  className="repo-tab-close"
                  title="关闭仓库"
                  onClick={(event) => {
                    event.stopPropagation()
                    void closeWorkspace(repoId)
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            )
          })}
        </div>
        <button className="icon-btn topbar-add-repo" title="打开仓库" onClick={addWorkspace}>
          <Plus size={15} />
        </button>
        <div className="topbar-global-actions">
          {repo && (
            <button
              className="icon-btn"
              title="操作记录"
              onClick={() => setActivityOpen(true)}
            >
              <Activity size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            title="工具与自定义命令"
            onClick={() => setToolsOpen(true)}
          >
            <Wrench size={16} />
          </button>
          {repo && (
            <button
              className="icon-btn"
              title="Git LFS"
              onClick={() => setLfsOpen(true)}
            >
              <HardDrive size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            title="GitHub"
            onClick={() => setGithubOpen(true)}
          >
            <Github size={16} />
          </button>
          {repo && (
            <button
              className="icon-btn"
              title="Patch 工具"
              onClick={() => setPatchOpen(true)}
            >
              <FileDown size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            title="命令面板 (Ctrl+K)"
            onClick={() => setPaletteOpen(true)}
          >
            <Command size={16} />
          </button>
          {updateAvailable && (
            <button
              className="icon-btn update-available"
              title={`有新版本 ${availableVersion ?? ''} 可安装`}
              onClick={() => setSettingsOpen(true)}
            >
              <Download size={16} />
              <span className="update-dot" />
            </button>
          )}
          <button
            className="icon-btn"
            title="设置"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="topbar-toolbar">
        {repo ? (
          <div className="active-repo-context">
            <FolderOpen size={14} className="text-subtle" />
            <span className="active-repo-path" title={repo.path}>
              {repo.path}
            </span>
            {status?.branch ? (
              <span className="branch-chip">
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {status.branch}
                {(status.ahead > 0 || status.behind > 0) && (
                  <span className="ahead-behind">
                    {status.ahead > 0 && <span>↑{status.ahead}</span>}
                    {status.behind > 0 && <span>↓{status.behind}</span>}
                  </span>
                )}
              </span>
            ) : (
              repo.headShort && (
                <span className="branch-chip mono">分离头指针 {repo.headShort}</span>
              )
            )}
          </div>
        ) : (
          <span className="text-[11.5px] text-[var(--text-subtle)]">未打开仓库</span>
        )}

        <span className="spacer" />

        {progress && (
          <div className="progress-pill" title={progress.message}>
            <span>{progress.phase}</span>
            {progress.percent !== null && (
              <span className="progress-track">
                <span
                  className="progress-fill block"
                  style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                />
              </span>
            )}
            {progress.percent !== null && <span>{Math.round(progress.percent)}%</span>}
          </div>
        )}

        {repo && (
          <div className="flex items-center gap-1">
            <button
              className="btn"
              title="Fetch（获取所有远程更新）"
              disabled={!!busy}
              onClick={() => handleRemote('fetch')}
            >
              <RefreshCw size={14} className={busy === 'fetch' ? 'animate-spin' : ''} />
              Fetch
            </button>
            <div className="flex items-center relative" ref={pullMenuRef}>
              <button
                className="btn"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                title={`Pull（默认：${pullModeLabel(savedPullStrategy ?? 'auto')}）`}
                disabled={!!busy}
                onClick={() => handleRemote('pull')}
              >
                <ArrowDown size={14} />
                Pull
              </button>
              <button
                className="btn"
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: '0 6px',
                  marginLeft: -1
                }}
                disabled={!!busy}
                onClick={() => {
                  setPushMenuOpen(false)
                  setPullMenuOpen((open) => !open)
                }}
                title="选择拉取策略"
              >
                <ChevronDown size={13} />
              </button>
              {pullMenuOpen && (
                <div
                  className="absolute right-0 top-[34px] z-30 min-w-[250px] p-1.5 rounded-[10px]"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-pop)'
                  }}
                >
                  <div className="px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-[var(--text-subtle)]">
                    拉取策略
                  </div>
                  {PULL_MODES.map((option) => {
                    const remembered = savedPullStrategy === option.mode
                    return (
                      <button
                        key={option.mode}
                        className="pull-menu-item"
                        onClick={() =>
                          handleRemote('pull', false, undefined, option.mode)
                        }
                      >
                        <span className="pull-menu-check">
                          {remembered && <Check size={12} />}
                        </span>
                        <span className="pull-menu-copy">
                          <strong>{option.title}</strong>
                          <span>{option.hint}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center relative" ref={pushMenuRef}>
              <button
                className="btn"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                title="Push（推送当前分支）"
                disabled={!!busy}
                onClick={() => handleRemote('push')}
              >
                <ArrowUp size={14} />
                Push
              </button>
              <button
                className="btn"
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: '0 6px',
                  marginLeft: -1
                }}
                disabled={!!busy}
                onClick={() => {
                  setPullMenuOpen(false)
                  setPushMenuOpen((open) => !open)
                }}
                title="更多推送选项"
              >
                <ChevronDown size={13} />
              </button>
              {pushMenuOpen && (
                <div
                  className="absolute right-0 top-[34px] z-30 min-w-[200px] p-1.5 rounded-[10px]"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-pop)'
                  }}
                >
                  <button
                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--surface-hover)] text-[12px] danger-text"
                    onClick={() => {
                      setPushMenuOpen(false)
                      setForceConfirm(true)
                    }}
                  >
                    强制推送（force-with-lease）
                  </button>
                  <button
                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--surface-hover)] text-[12px]"
                    onClick={() => handleRemote('push')}
                  >
                    普通推送
                  </button>
                  {remotes.length > 0 && (
                    <>
                      <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                      <div className="px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-[var(--text-subtle)]">
                        指定远程
                      </div>
                      {remotes.map((remote) => (
                        <button
                          key={remote.name}
                          className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--surface-hover)] text-[12px]"
                          onClick={() => handleRemote('push', false, remote.name)}
                        >
                          推送到 <span className="mono">{remote.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {repo && (
          <button className="icon-btn" title="在终端中打开" onClick={openTerminal}>
            <Terminal size={16} />
          </button>
        )}
      </div>

      <ConfirmDialog
        open={forceConfirm}
        title="强制推送"
        danger
        confirmLabel="强制推送"
        message={
          <div>
            <p style={{ marginTop: 0 }}>
              将使用 <span className="mono">--force-with-lease</span> 覆盖远程分支。
              如果他人在你上次 fetch 后推送了新提交，操作会被安全拒绝。
            </p>
            <p style={{ marginBottom: 0 }}>
              目标分支：<span className="mono">{status?.branch ?? '-'}</span>
            </p>
          </div>
        }
        onCancel={() => setForceConfirm(false)}
        onConfirm={() => handleRemote('push', true)}
      />
    </header>
  )
}
