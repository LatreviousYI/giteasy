import { useEffect, useState, type ReactNode } from 'react'
import { PromptDialog } from '../../components/Dialogs'
import { copyTextWithToast } from '../../lib/clipboard'
import { ipc } from '../../lib/ipc'
import { useCommitIsAncestor, useInvalidateRepo, useStatus } from '../../lib/queries'
import type { CommitDto, RepoInfo } from '../../lib/types'
import { useApp } from '../../store/app'
import ResetBranchDialog, { type ResetMode } from '../branches/ResetBranchDialog'
import RebaseDialog from '../rebase/RebaseDialog'
import TagDialog from '../tags/TagDialog'
import CommitContextMenu, { type CommitMenuState } from './CommitContextMenu'

export function useHistoryCommitActions(): {
  operationState: string
  openMenu: (commit: CommitDto, x: number, y: number) => void
  overlays: ReactNode
} {
  const repo = useApp((state) => state.repo)
  const selectCommit = useApp((state) => state.selectCommit)
  const setRepo = useApp((state) => state.setRepo)
  const toast = useApp((state) => state.toast)
  const errorToast = useApp((state) => state.errorToast)
  const setView = useApp((state) => state.setView)
  const { data: status } = useStatus(repo?.path ?? null)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<CommitMenuState | null>(null)
  const [resetCommit, setResetCommit] = useState<CommitDto | null>(null)
  const [rebaseCommit, setRebaseCommit] = useState<CommitDto | null>(null)
  const [branchCommit, setBranchCommit] = useState<CommitDto | null>(null)
  const [tagCommit, setTagCommit] = useState<CommitDto | null>(null)
  const ancestorQuery = useCommitIsAncestor(repo?.path ?? null, menu?.commit.oid ?? null)

  const currentBranch = status?.branch ?? repo?.branch ?? null
  const operationState = status?.state ?? repo?.state ?? 'clean'

  useEffect(() => {
    if (menu && ancestorQuery.error) errorToast(ancestorQuery.error)
  }, [ancestorQuery.error, errorToast, menu])

  const runRepoMutation = async (
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

  const cherryPick = (commit: CommitDto) => {
    if (!repo || !currentBranch) return
    void runRepoMutation(
      () => ipc.cherryPick(repo.path, [commit.oid]),
      `已将 ${commit.shortOid} Cherry-pick 到 ${currentBranch}`
    )
  }

  const revert = (commit: CommitDto) => {
    if (!repo || !currentBranch) return
    void runRepoMutation(() => ipc.revert(repo.path, [commit.oid]), `已回滚提交 ${commit.shortOid}`)
  }

  const reset = async (mode: ResetMode) => {
    if (!repo || !resetCommit) return
    const result = await runRepoMutation(
      () => ipc.reset(repo.path, resetCommit.oid, mode),
      `已重置当前分支到 ${resetCommit.shortOid}（${mode}）`
    )
    if (result !== 'error') setResetCommit(null)
  }

  const checkout = (commit: CommitDto) => {
    if (!repo) return
    void runRepoMutation(
      () => ipc.commitCheckout(repo.path, commit.oid),
      `已检出提交 ${commit.shortOid}（分离头指针）`
    )
  }

  const createBranch = async (name: string) => {
    if (!repo || !branchCommit) return
    const result = await runRepoMutation(
      () => ipc.branchCreate(repo.path, name, true, branchCommit.oid),
      `已创建并切换到分支 ${name}`
    )
    if (result !== 'error') setBranchCommit(null)
  }

  const copyHash = (commit: CommitDto) => {
    void copyTextWithToast(commit.oid, '已复制提交哈希', toast)
  }

  const overlays = (
    <>
      {menu && (
        <CommitContextMenu
          menu={menu}
          currentBranch={currentBranch}
          operationState={operationState}
          ancestor={ancestorQuery.data}
          ancestorLoading={ancestorQuery.isLoading}
          busy={busy}
          onDismiss={() => setMenu(null)}
          onCherryPick={cherryPick}
          onRevert={revert}
          onReset={setResetCommit}
          onRebase={setRebaseCommit}
          onCreateBranch={setBranchCommit}
          onCreateTag={setTagCommit}
          onCheckout={checkout}
          onCopy={copyHash}
        />
      )}

      {resetCommit && currentBranch && (
        <ResetBranchDialog
          currentBranch={currentBranch}
          target={`${resetCommit.shortOid} ${resetCommit.subject}`}
          targetOid={resetCommit.oid}
          busy={busy}
          onCancel={() => setResetCommit(null)}
          onSubmit={(mode) => void reset(mode)}
        />
      )}

      {rebaseCommit && (
        <RebaseDialog
          base={rebaseCommit.oid}
          baseSubject={rebaseCommit.subject}
          onClose={() => setRebaseCommit(null)}
        />
      )}

      <PromptDialog
        open={!!branchCommit}
        title="从提交创建并检出分支"
        label="分支名称"
        placeholder={`branch-from-${branchCommit?.shortOid ?? ''}`}
        defaultValue={`branch-from-${branchCommit?.shortOid ?? ''}`}
        busy={busy}
        onSubmit={(name) => void createBranch(name)}
        onCancel={() => setBranchCommit(null)}
      />

      {tagCommit && (
        <TagDialog
          onClose={() => setTagCommit(null)}
          startPoint={tagCommit.oid}
          sourceLabel={`${tagCommit.shortOid} ${tagCommit.subject}`}
        />
      )}
    </>
  )

  return {
    operationState,
    openMenu: (commit, x, y) => {
      selectCommit(commit.oid)
      setMenu({ commit, x, y })
    },
    overlays
  }
}
