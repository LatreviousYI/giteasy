import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, FolderGit2 } from 'lucide-react'
import { useApp } from '../store/app'
import {
  useBranches,
  useConflicts,
  useInvalidateRepo,
  useRecentRepos,
  useRemotes,
  useStashes,
  useSubmodules,
  useTags,
  useWorktrees,
  useStatus
} from '../lib/queries'
import { ipc } from '../lib/ipc'
import { pickDirectory, useInitRepo, useOpenRepo } from '../lib/actions'
import { useRemoteActions } from '../lib/remote'
import { resolveTrackedRemote } from '../lib/branch'
import { ConfirmDialog, PromptDialog } from '../components/Dialogs'
import RemotesDialog from '../features/repo/RemotesDialog'
import DiscoverDialog from '../features/repo/DiscoverDialog'
import PushBranchDialog from '../features/remote/PushBranchDialog'
import TagDialog from '../features/tags/TagDialog'
import type { BranchDto, RemoteDto, StashDto, SubmoduleDto } from '../lib/types'
import {
  BranchSection,
  RemoteSection,
  StashSection,
  SubmoduleSection,
  TagSection,
  WorktreeSection,
  type SidebarConfirmState
} from './sidebar/SidebarSections'
import StashModal from '../features/stashes/StashModal'
import StashCreateDialog from '../features/stashes/StashCreateDialog'
import { repoSidebarWidthKey } from '../lib/workspace'
import WorktreeDialog from '../features/repo/WorktreeDialog'
import SubmoduleDialog from '../features/repo/SubmoduleDialog'
import SidebarRepoMenu from './sidebar/SidebarRepoMenu'
import BranchContextMenu, { type BranchMenuState } from './sidebar/BranchContextMenu'
import RemoteBranchCreateDialog from '../features/branches/RemoteBranchCreateDialog'
import DeleteLocalBranchDialog from '../features/branches/DeleteLocalBranchDialog'
import { useBranchActions } from '../features/branches/useBranchActions'

type PromptKind = 'branch' | 'rename' | 'upstream'

interface PromptState {
  kind: PromptKind
  branch?: BranchDto
}

interface RemoteBranchCreateState {
  branch: BranchDto
  remote: RemoteDto
}

function readSidebarWidth(repoId: string | null) {
  if (!repoId) return 268
  const saved = Number(
    window.localStorage.getItem(repoSidebarWidthKey(repoId)) ??
      window.localStorage.getItem('giteasy.sidebarWidth')
  )
  return Number.isFinite(saved) && saved >= 220 ? Math.min(460, saved) : 268
}

export default function Sidebar() {
  const repo = useApp((s) => s.repo)
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const selectCommit = useApp((s) => s.selectCommit)
  const setRepo = useApp((s) => s.setRepo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const path = repo?.path ?? null
  const invalidate = useInvalidateRepo(path)

  const { data: status } = useStatus(path)
  const { data: branches = [] } = useBranches(path)
  const { data: tags = [] } = useTags(path)
  const { data: remotesData = [] } = useRemotes(path)
  const { data: stashes = [] } = useStashes(path)
  const { data: conflicts = [] } = useConflicts(path)
  const { data: submodules = [] } = useSubmodules(path)
  const { data: worktrees = [] } = useWorktrees(path)
  const { data: recent = [] } = useRecentRepos()
  const openRepo = useOpenRepo()
  const initRepo = useInitRepo()
  const { runBranchPull } = useRemoteActions()
  const branchActions = useBranchActions()

  const [repoMenu, setRepoMenu] = useState(false)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [confirm, setConfirm] = useState<SidebarConfirmState | null>(null)
  const [menu, setMenu] = useState<BranchMenuState | null>(null)
  const [remoteBranchCreate, setRemoteBranchCreate] = useState<RemoteBranchCreateState | null>(null)
  const [deleteBranch, setDeleteBranch] = useState<BranchDto | null>(null)
  const [stashPreview, setStashPreview] = useState<StashDto | null>(null)
  const [stashCreateOpen, setStashCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remotesOpen, setRemotesOpen] = useState(false)
  const [collapsedRemotes, setCollapsedRemotes] = useState<Record<string, boolean>>({})
  const [pushBranch, setPushBranch] = useState<BranchDto | null>(null)
  const [discoverRoot, setDiscoverRoot] = useState<string | null>(null)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [worktreeDialog, setWorktreeDialog] = useState<{
    initialBranch: BranchDto | null
  } | null>(null)
  const [submoduleDialogOpen, setSubmoduleDialogOpen] = useState(false)
  const [editingSubmodule, setEditingSubmodule] = useState<SubmoduleDto | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => readSidebarWidth(repo?.path ?? null))
  const widthRepoRef = useRef<string | null>(null)
  const repoPath = repo?.path ?? null

  useEffect(() => {
    if (!repoPath) {
      widthRepoRef.current = null
      return
    }
    widthRepoRef.current = repoPath
    setSidebarWidth(readSidebarWidth(repoPath))
  }, [repoPath])

  useEffect(() => {
    if (!repoPath || widthRepoRef.current !== repoPath) return
    window.localStorage.setItem(repoSidebarWidthKey(repoPath), String(sidebarWidth))
  }, [repoPath, sidebarWidth])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const onMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(Math.max(220, Math.min(460, startWidth + moveEvent.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const locals = useMemo(() => branches.filter((b) => !b.isRemote), [branches])
  const remoteBranches = useMemo(() => branches.filter((b) => b.isRemote), [branches])
  const remoteNames = useMemo(() => remotesData.map((remote) => remote.name), [remotesData])

  const focusBranchHistory = (value: string, branch: BranchDto) => {
    setPicked(value)
    selectCommit(branch.oid)
    setView('history')
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (!path) return
    try {
      await action()
      invalidate()
      toast('success', success)
    } catch (error) {
      errorToast(error)
    }
  }

  const promptConfig: Record<
    PromptKind,
    { title: string; label: string; placeholder?: string; value?: string }
  > = {
    branch: { title: '新建分支', label: '分支名称', placeholder: 'feature/my-change' },
    rename: {
      title: '重命名分支',
      label: '新的分支名称',
      value: prompt?.branch?.name ?? ''
    },
    upstream: {
      title: '设置上游分支',
      label: '上游分支',
      placeholder: 'origin/main',
      value: prompt?.branch?.upstream ?? `origin/${prompt?.branch?.name ?? ''}`
    }
  }

  const submitPrompt = async (value: string) => {
    if (!path || !prompt) return
    setBusy(true)
    try {
      if (prompt.kind === 'branch') {
        const info = await ipc.branchCreate(path, value, true)
        setRepo(info)
        toast('success', `已创建并切换到 ${value}`)
      } else if (prompt.kind === 'rename' && prompt.branch) {
        const info = await ipc.branchRename(path, prompt.branch.name, value)
        setRepo(info)
        toast('success', `已重命名为 ${value}`)
      } else if (prompt.kind === 'upstream' && prompt.branch) {
        await ipc.branchSetUpstream(path, prompt.branch.name, value)
        toast('success', `已将 ${prompt.branch.name} 的上游设为 ${value}`)
      }
      invalidate()
      setPrompt(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const createRemoteBranch = async (name: string, checkout: boolean) => {
    if (!path || !remoteBranchCreate) return
    setBusy(true)
    try {
      const existing = locals.find((branch) => branch.name === name)
      if (existing) {
        if (!checkout) {
          toast('info', `本地分支 ${name} 已存在，未创建`)
        } else {
          const info = await ipc.branchCheckout(path, name)
          setRepo(info)
          toast('success', `分支 ${name} 已存在，已切换`)
        }
      } else {
        const info = await ipc.branchCreate(path, name, checkout, remoteBranchCreate.branch.name)
        if (checkout) setRepo(info)
        toast('success', checkout ? `已创建并切换到 ${name}` : `已创建分支 ${name}`)
      }
      invalidate()
      setRemoteBranchCreate(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const deleteLocalBranch = async (deleteRemote: boolean) => {
    if (!path || !deleteBranch) return
    const tracked = resolveTrackedRemote(deleteBranch.upstream, remoteNames)
    if (deleteRemote && !tracked) {
      errorToast({
        kind: 'user',
        code: 'E_NO_UPSTREAM',
        message: '该分支没有可删除的远程追踪分支'
      })
      return
    }
    const remoteName = deleteRemote && tracked ? tracked.remote : null
    const remoteBranch = deleteRemote && tracked ? tracked.branch : null

    setBusy(true)
    try {
      await ipc.branchDelete(path, deleteBranch.name, true, remoteName, remoteBranch)
      toast(
        'success',
        deleteRemote
          ? `已删除本地分支 ${deleteBranch.name} 和远程分支 ${tracked?.remote}/${tracked?.branch}`
          : `已删除分支 ${deleteBranch.name}`
      )
      setDeleteBranch(null)
    } catch (error) {
      errorToast(error)
    } finally {
      invalidate()
      setBusy(false)
    }
  }

  const confirmDeleteRemoteBranch = (remote: RemoteDto, branch: BranchDto, shortName: string) => {
    setConfirm({
      title: '删除远程分支',
      message: (
        <span>
          将执行{' '}
          <span className="mono">
            git push {remote.name} --delete {shortName}
          </span>
          ，该分支会从远程服务器删除，无法通过本地操作恢复。
        </span>
      ),
      confirmLabel: '删除远程分支',
      danger: true,
      action: async () => {
        if (!path) return
        await ipc.remoteBranchDelete(path, remote.name, shortName)
        toast('success', `已删除远程分支 ${branch.name}`)
      }
    })
  }

  const executeConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await confirm.action()
      invalidate()
      setConfirm(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  if (!repo) return null

  const openRecentRepository = async (repoPath: string) => {
    setRepoMenu(false)
    await openRepo(repoPath)
  }

  const openRepositoryDirectory = async () => {
    setRepoMenu(false)
    const dir = await pickDirectory('选择 Git 仓库目录')
    if (dir) await openRepo(dir)
  }

  const initializeRepository = async () => {
    setRepoMenu(false)
    const dir = await pickDirectory('选择用于初始化仓库的目录')
    if (dir) await initRepo(dir)
  }

  const discoverRepositories = async () => {
    setRepoMenu(false)
    const dir = await pickDirectory('选择要扫描的目录')
    if (dir) setDiscoverRoot(dir)
  }

  const manageRemotes = () => {
    setRepoMenu(false)
    setRemotesOpen(true)
  }

  const openRepositoryTerminal = async () => {
    setRepoMenu(false)
    try {
      await ipc.openInTerminal(repo.path)
    } catch (error) {
      errorToast(error)
    }
  }

  const closeRepository = async () => {
    setRepoMenu(false)
    try {
      await ipc.repoClose(repo.path)
      setRepo(null)
    } catch (error) {
      errorToast(error)
    }
  }

  return (
    <aside className="sidebar" style={{ width: sidebarWidth, flex: `0 0 ${sidebarWidth}px` }}>
      <div className="sidebar-resizer" onPointerDown={startResize} title="拖动调整侧边栏宽度" />
      <div className="relative px-2 pt-2 pb-1">
        <button className="repo-switch w-full" onClick={() => setRepoMenu((open) => !open)}>
          <FolderGit2 size={15} className="text-[var(--accent)]" />
          <span className="min-w-0 flex-1 text-left">
            <span className="repo-name block">{repo.name}</span>
            <span className="repo-path block">{repo.path}</span>
          </span>
          <ChevronDown size={14} className="text-subtle" />
        </button>

        {repoMenu && (
          <SidebarRepoMenu
            repoPath={repo.path}
            recent={recent}
            onDismiss={() => setRepoMenu(false)}
            onOpenRecent={openRecentRepository}
            onOpenDirectory={openRepositoryDirectory}
            onInitializeRepository={initializeRepository}
            onDiscoverRepositories={discoverRepositories}
            onManageRemotes={manageRemotes}
            onOpenTerminal={openRepositoryTerminal}
            onCloseRepository={closeRepository}
          />
        )}
      </div>

      <div className="nav-seg">
        <button className={view === 'changes' ? 'active' : ''} onClick={() => setView('changes')}>
          变更
          {status && status.files.length > 0 && (
            <span className="text-[10px] text-[var(--text-subtle)]">{status.files.length}</span>
          )}
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          历史
        </button>
        <button
          className={view === 'conflicts' ? 'active' : ''}
          onClick={() => setView('conflicts')}
        >
          冲突
          {conflicts.length > 0 && (
            <span className="text-[10px] text-[var(--danger)]">{conflicts.length}</span>
          )}
        </button>
      </div>

      <div className="sidebar-scroll">
        <BranchSection
          branches={locals}
          picked={picked}
          onPick={focusBranchHistory}
          onCreate={() => setPrompt({ kind: 'branch' })}
          onCheckout={(branch) =>
            run(async () => {
              const info = await ipc.branchCheckout(repo.path, branch.name)
              setRepo(info)
            }, `已切换到 ${branch.name}`)
          }
          onContextMenu={(event, branch) => {
            event.preventDefault()
            setMenu({
              x: event.clientX,
              y: event.clientY,
              scope: 'local',
              branch
            })
          }}
        />

        <RemoteSection
          remotes={remotesData}
          branches={remoteBranches}
          picked={picked}
          collapsed={collapsedRemotes}
          onAdd={() => setRemotesOpen(true)}
          onToggle={(name) =>
            setCollapsedRemotes((prev) => ({
              ...prev,
              [name]: !prev[name]
            }))
          }
          onPick={focusBranchHistory}
          onCheckout={(branch) =>
            run(async () => {
              const info = await ipc.branchCheckout(repo.path, branch.name)
              setRepo(info)
            }, `已检出 ${branch.name}`)
          }
          onContextMenu={(event, branch, remote) => {
            event.preventDefault()
            setMenu({
              x: event.clientX,
              y: event.clientY,
              scope: 'remote',
              branch,
              remote
            })
          }}
          onWorktree={(branch) => setWorktreeDialog({ initialBranch: branch })}
          onDeleteRemote={(remote) =>
            setConfirm({
              title: '删除远程',
              message: (
                <span>
                  确定删除远程 <span className="mono">{remote.name}</span> 吗？
                  此操作只影响本地配置（{remote.url}），不会删除远程服务器上的仓库。
                </span>
              ),
              confirmLabel: '删除',
              danger: true,
              action: async () => {
                await ipc.remoteRemove(repo.path, remote.name)
                toast('success', `已删除远程 ${remote.name}`)
              }
            })
          }
          onDeleteBranch={confirmDeleteRemoteBranch}
        />

        <TagSection
          tags={tags}
          onCreate={() => setTagDialogOpen(true)}
          onCheckout={(tag) =>
            run(async () => {
              const info = await ipc.commitCheckout(repo.path, tag.oid)
              setRepo(info)
            }, `已检出标签 ${tag.name}（分离头指针）`)
          }
          onPush={(tag) =>
            run(() => ipc.tagPush(repo.path, tag.name, 'origin'), `已推送标签 ${tag.name}`)
          }
          onDelete={(tag) =>
            setConfirm({
              title: '删除标签',
              message: (
                <span>
                  确定删除标签 <span className="mono">{tag.name}</span> 吗？此操作不会删除提交。
                </span>
              ),
              confirmLabel: '删除',
              danger: true,
              action: async () => {
                await ipc.tagDelete(repo.path, tag.name)
                toast('success', `已删除标签 ${tag.name}`)
              }
            })
          }
        />

        <StashSection
          stashes={stashes}
          onCreate={() => setStashCreateOpen(true)}
          onPreview={setStashPreview}
          onPop={(stash) => run(() => ipc.stashApply(repo.path, stash.index, true), '已应用储藏')}
          onDelete={(stash) =>
            setConfirm({
              title: '删除储藏',
              message: `确定删除 stash@{${stash.index}} 吗？此操作不可撤销。`,
              confirmLabel: '删除',
              danger: true,
              action: async () => {
                await ipc.stashDrop(repo.path, stash.index)
                toast('success', '已删除储藏')
              }
            })
          }
        />

        <SubmoduleSection
          submodules={submodules}
          onUpdate={() => run(() => ipc.submoduleUpdate(repo.path, true), '子模块已更新')}
          onOpen={(submodule) =>
            openRepo(`${repo.path.replace(/\/$/, '')}/${submodule.path.replace(/^\/+/, '')}`)
          }
          onAdd={() => {
            setEditingSubmodule(null)
            setSubmoduleDialogOpen(true)
          }}
          onMove={(submodule) => {
            setEditingSubmodule(submodule)
            setSubmoduleDialogOpen(true)
          }}
          onRemove={(submodule) =>
            setConfirm({
              title: '删除 Submodule',
              message: (
                <span>
                  将取消初始化并移除子模块 <span className="mono">{submodule.path}</span>
                  。此操作会修改 `.gitmodules` 和父仓库索引。
                </span>
              ),
              confirmLabel: '删除子模块',
              danger: true,
              action: async () => {
                await ipc.submoduleRemove(repo.path, submodule.path)
                toast('success', '子模块已删除')
              }
            })
          }
        />

        <WorktreeSection
          worktrees={worktrees}
          repoPath={repo.path}
          onAdd={() => setWorktreeDialog({ initialBranch: null })}
          onOpen={(worktree) => openRepo(worktree.path)}
          onRemove={(worktree) =>
            setConfirm({
              title: '移除工作树',
              message: (
                <span>
                  将移除工作树 <span className="mono">{worktree.path}</span>
                  ，目录中的未提交改动可能丢失。
                </span>
              ),
              confirmLabel: '强制移除',
              danger: true,
              action: async () => {
                await ipc.worktreeRemove(repo.path, worktree.path, true)
                toast('success', '已移除工作树')
              }
            })
          }
        />
      </div>

      {menu && (
        <BranchContextMenu
          menu={menu}
          remoteNames={remoteNames}
          currentBranch={branchActions.currentBranch}
          currentUpstream={status?.upstream ?? null}
          operationState={branchActions.operationState}
          onDismiss={() => setMenu(null)}
          onCreateFromRemote={(branch, remote) => setRemoteBranchCreate({ branch, remote })}
          onCheckout={(branch) =>
            run(async () => {
              const info = await ipc.branchCheckout(repo.path, branch.name)
              setRepo(info)
            }, `已切换到 ${branch.name}`)
          }
          onPull={(branch, tracked) => void runBranchPull(branch, tracked)}
          onPullRemote={branchActions.pullRemote}
          onMerge={branchActions.merge}
          onRebase={branchActions.rebase}
          onSquash={branchActions.openSquash}
          onCherryPick={branchActions.openCherryPick}
          onReset={branchActions.openReset}
          onCreateTag={branchActions.openTag}
          onDeleteRemote={(branch, remote) =>
            confirmDeleteRemoteBranch(
              remote,
              branch,
              branch.name.startsWith(`${remote.name}/`)
                ? branch.name.slice(remote.name.length + 1)
                : branch.name
            )
          }
          onPush={setPushBranch}
          onSetUpstream={(branch) => setPrompt({ kind: 'upstream', branch })}
          onCancelUpstream={(branch) =>
            run(() => ipc.branchSetUpstream(repo.path, branch.name, null), '已取消上游跟踪')
          }
          onRename={(branch) => setPrompt({ kind: 'rename', branch })}
          onDelete={setDeleteBranch}
        />
      )}

      <PromptDialog
        open={!!prompt}
        title={prompt ? promptConfig[prompt.kind].title : ''}
        label={prompt ? promptConfig[prompt.kind].label : ''}
        placeholder={prompt ? promptConfig[prompt.kind].placeholder : undefined}
        defaultValue={prompt ? promptConfig[prompt.kind].value : ''}
        busy={busy}
        onSubmit={submitPrompt}
        onCancel={() => setPrompt(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={busy}
        onConfirm={executeConfirm}
        onCancel={() => setConfirm(null)}
      />

      {stashPreview && (
        <StashModal
          repoPath={repo.path}
          stash={stashPreview}
          onClose={() => setStashPreview(null)}
          onChanged={() => {
            invalidate()
            setStashPreview(null)
          }}
        />
      )}
      {stashCreateOpen && (
        <StashCreateDialog
          repoPath={repo.path}
          files={status?.files ?? []}
          onClose={() => setStashCreateOpen(false)}
          onChanged={invalidate}
        />
      )}

      {remotesOpen && <RemotesDialog onClose={() => setRemotesOpen(false)} />}
      {pushBranch && <PushBranchDialog branch={pushBranch} onClose={() => setPushBranch(null)} />}
      {remoteBranchCreate && (
        <RemoteBranchCreateDialog
          branch={remoteBranchCreate.branch}
          remote={remoteBranchCreate.remote}
          existingLocalNames={locals.map((branch) => branch.name)}
          busy={busy}
          onCancel={() => setRemoteBranchCreate(null)}
          onSubmit={(name, checkout) => void createRemoteBranch(name, checkout)}
        />
      )}
      {deleteBranch && (
        <DeleteLocalBranchDialog
          branch={deleteBranch}
          tracked={resolveTrackedRemote(deleteBranch.upstream, remoteNames)}
          busy={busy}
          onCancel={() => setDeleteBranch(null)}
          onConfirm={(deleteRemote) => void deleteLocalBranch(deleteRemote)}
        />
      )}
      {discoverRoot && <DiscoverDialog root={discoverRoot} onClose={() => setDiscoverRoot(null)} />}
      {tagDialogOpen && <TagDialog onClose={() => setTagDialogOpen(false)} />}
      {branchActions.dialogs}
      {worktreeDialog && (
        <WorktreeDialog
          initialBranch={worktreeDialog.initialBranch}
          branches={branches}
          onClose={() => setWorktreeDialog(null)}
          onCreated={invalidate}
        />
      )}
      {submoduleDialogOpen && (
        <SubmoduleDialog
          submodule={editingSubmodule}
          onClose={() => {
            setSubmoduleDialogOpen(false)
            setEditingSubmodule(null)
          }}
        />
      )}
    </aside>
  )
}
