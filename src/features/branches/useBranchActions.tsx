import { useState, type ReactNode } from 'react'
import { useInvalidateRepo, useStatus } from '../../lib/queries'
import { ipc } from '../../lib/ipc'
import { useRemoteActions } from '../../lib/remote'
import { useApp } from '../../store/app'
import type { BranchDto, RemoteDto, RepoInfo } from '../../lib/types'
import TagDialog from '../tags/TagDialog'
import CommitSelectionDialog, { type CommitSelectionMode } from './CommitSelectionDialog'
import ResetBranchDialog, { type ResetMode } from './ResetBranchDialog'
import SquashMergeDialog from './SquashMergeDialog'

interface BranchActionState {
  branch: BranchDto
}

interface CommitSelectionState {
  branch: BranchDto
  mode: CommitSelectionMode
}

export function useBranchActions(): {
  currentBranch: string | null
  operationState: string
  busy: boolean
  merge: (branch: BranchDto) => void
  rebase: (branch: BranchDto) => void
  openSquash: (branch: BranchDto) => void
  openCherryPick: (branch: BranchDto) => void
  openReset: (branch: BranchDto) => void
  openTag: (branch: BranchDto) => void
  pullRemote: (branch: BranchDto, remote: RemoteDto) => void
  dialogs: ReactNode
} {
  const repo = useApp((state) => state.repo)
  const setRepo = useApp((state) => state.setRepo)
  const toast = useApp((state) => state.toast)
  const errorToast = useApp((state) => state.errorToast)
  const setView = useApp((state) => state.setView)
  const { data: status } = useStatus(repo?.path ?? null)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const { runRemote } = useRemoteActions()
  const [busy, setBusy] = useState(false)
  const [squash, setSquash] = useState<BranchActionState | null>(null)
  const [reset, setReset] = useState<BranchActionState | null>(null)
  const [commitSelection, setCommitSelection] = useState<CommitSelectionState | null>(null)
  const [tagBranch, setTagBranch] = useState<BranchDto | null>(null)

  const currentBranch = status?.branch ?? repo?.branch ?? null
  const operationState = status?.state ?? repo?.state ?? 'clean'

  const runMutation = async (
    action: () => Promise<RepoInfo>,
    success: string
  ): Promise<'success' | 'conflict' | 'error'> => {
    if (!repo) return 'error'
    setBusy(true)
    try {
      const info = await action()
      setRepo(info)
      invalidate()
      toast('success', success)
      return 'success'
    } catch (error) {
      invalidate()
      if ((error as { kind?: string })?.kind === 'conflict') {
        setView('conflicts')
        toast('warn', '操作产生冲突', {
          message: '请在冲突页解决并标记全部文件后继续操作。'
        })
        return 'conflict'
      }
      errorToast(error)
      return 'error'
    } finally {
      setBusy(false)
    }
  }

  const merge = (branch: BranchDto) => {
    if (!repo) return
    void runMutation(
      () => ipc.mergeBranch(repo.path, branch.name),
      `已合并 ${branch.name} 到 ${currentBranch}`
    )
  }

  const rebase = (branch: BranchDto) => {
    if (!repo || !currentBranch) return
    void runMutation(
      () => ipc.rebaseBranch(repo.path, branch.name),
      `已将 ${currentBranch} 变基到 ${branch.name}`
    )
  }

  const confirmSquash = async (message: string) => {
    if (!repo || !squash || !currentBranch) return
    const result = await runMutation(
      () => ipc.squashMergeBranch(repo.path, squash.branch.name, message),
      `已 Squash 合并 ${squash.branch.name} 到 ${currentBranch}`
    )
    if (result !== 'error') setSquash(null)
  }

  const confirmReset = async (mode: ResetMode) => {
    if (!repo || !reset) return
    const result = await runMutation(
      () => ipc.reset(repo.path, reset.branch.oid, mode),
      `已重置当前分支到 ${reset.branch.name} (${reset.branch.shortOid})`
    )
    if (result !== 'error') setReset(null)
  }

  const confirmCommitSelection = async (oids: string[]) => {
    if (!repo || !commitSelection) return
    const { branch, mode } = commitSelection
    const result = await runMutation(
      () =>
        mode === 'cherry-pick' ? ipc.cherryPick(repo.path, oids) : ipc.revert(repo.path, oids),
      mode === 'cherry-pick'
        ? `已从 ${branch.name} Cherry-pick ${oids.length} 个提交`
        : `已回滚 ${oids.length} 个提交`
    )
    if (result !== 'error') setCommitSelection(null)
  }

  const pullRemote = (branch: BranchDto, remote: RemoteDto) => {
    if (!repo || !currentBranch || status?.upstream !== branch.name) return
    void runRemote('pull', false, remote.name, 'auto', {
      name: currentBranch,
      upstream: status.upstream
    })
  }

  const dialogs = (
    <>
      {squash && currentBranch && (
        <SquashMergeDialog
          source={squash.branch.name}
          target={currentBranch}
          busy={busy}
          onCancel={() => setSquash(null)}
          onSubmit={(message) => void confirmSquash(message)}
        />
      )}
      {reset && currentBranch && (
        <ResetBranchDialog
          currentBranch={currentBranch}
          target={reset.branch.name}
          targetOid={reset.branch.oid}
          busy={busy}
          onCancel={() => setReset(null)}
          onSubmit={(mode) => void confirmReset(mode)}
        />
      )}
      {commitSelection && currentBranch && (
        <CommitSelectionDialog
          repoPath={repo?.path ?? ''}
          mode={commitSelection.mode}
          sourceRef={commitSelection.branch.name}
          sourceLabel={commitSelection.branch.name}
          currentBranch={currentBranch}
          busy={busy}
          onCancel={() => setCommitSelection(null)}
          onSubmit={(oids) => void confirmCommitSelection(oids)}
        />
      )}
      {tagBranch && (
        <TagDialog
          onClose={() => setTagBranch(null)}
          startPoint={tagBranch.name}
          sourceLabel={tagBranch.name}
        />
      )}
    </>
  )

  return {
    currentBranch,
    operationState,
    busy,
    merge,
    rebase,
    openSquash: (branch) => setSquash({ branch }),
    openCherryPick: (branch) => setCommitSelection({ branch, mode: 'cherry-pick' }),
    openReset: (branch) => setReset({ branch }),
    openTag: (branch) => setTagBranch(branch),
    pullRemote,
    dialogs
  }
}
