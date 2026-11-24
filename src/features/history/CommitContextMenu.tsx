import {
  ContextMenuDivider,
  ContextMenuItem,
  ContextMenuSurface
} from '../../components/ContextMenu'
import type { CommitDto } from '../../lib/types'

export interface CommitMenuState {
  x: number
  y: number
  commit: CommitDto
}

interface CommitContextMenuProps {
  menu: CommitMenuState
  currentBranch: string | null
  operationState: string
  ancestor: boolean | undefined
  ancestorLoading: boolean
  busy: boolean
  onDismiss: () => void
  onCherryPick: (commit: CommitDto) => void
  onRevert: (commit: CommitDto) => void
  onReset: (commit: CommitDto) => void
  onRebase: (commit: CommitDto) => void
  onCreateBranch: (commit: CommitDto) => void
  onCreateTag: (commit: CommitDto) => void
  onCheckout: (commit: CommitDto) => void
  onCopy: (commit: CommitDto) => void
}

export default function CommitContextMenu({
  menu,
  currentBranch,
  operationState,
  ancestor,
  ancestorLoading,
  busy,
  onDismiss,
  onCherryPick,
  onRevert,
  onReset,
  onRebase,
  onCreateBranch,
  onCreateTag,
  onCheckout,
  onCopy
}: CommitContextMenuProps) {
  const operationInProgress = operationState !== 'clean'
  const detached = !currentBranch
  const mergeCommit = menu.commit.parents.length > 1
  const branchOperationDisabled = busy || detached || operationInProgress
  const branchOperationReason = detached
    ? '当前处于分离头指针，请先检出本地分支'
    : operationInProgress
      ? `仓库正在 ${operationState}，请先完成或中止当前操作`
      : busy
        ? '当前操作尚未完成'
        : undefined
  const cherryPickDisabled = branchOperationDisabled || mergeCommit
  const cherryPickReason = mergeCommit
    ? '暂不支持 Cherry-pick Merge 提交，需要先指定 mainline'
    : branchOperationReason
  const revertDisabled =
    branchOperationDisabled || mergeCommit || ancestorLoading || ancestor === false
  const revertReason = mergeCommit
    ? '暂不支持回滚 Merge 提交，需要先指定 mainline'
    : (branchOperationReason ??
      (ancestorLoading
        ? '正在检查提交是否属于当前分支历史'
        : ancestor === false
          ? '该提交不在当前分支历史中，无法回滚。可以改用 Cherry-pick。'
          : undefined))

  const runAndDismiss = (action: () => void) => {
    action()
    onDismiss()
  }

  return (
    <ContextMenuSurface x={menu.x} y={menu.y} className="commit-context-menu" onDismiss={onDismiss}>
      <div className="px-2.5 py-1.5 text-[10.5px] text-[var(--text-subtle)]">
        <span className="mono">{menu.commit.shortOid}</span>
        <span> · {menu.commit.subject || '(无提交信息)'}</span>
      </div>

      <ContextMenuItem
        description="保留原提交信息，在当前分支创建新提交"
        disabled={cherryPickDisabled}
        title={cherryPickReason}
        onClick={() => runAndDismiss(() => onCherryPick(menu.commit))}
      >
        Cherry-pick 到当前分支
      </ContextMenuItem>
      <ContextMenuItem
        description="创建反向提交，不重写历史"
        disabled={revertDisabled}
        title={revertReason}
        onClick={() => runAndDismiss(() => onRevert(menu.commit))}
      >
        回滚此提交
      </ContextMenuItem>
      <ContextMenuItem
        description="移动当前分支指针，可选择保留或丢弃改动"
        disabled={branchOperationDisabled}
        title={branchOperationReason}
        onClick={() => runAndDismiss(() => onReset(menu.commit))}
      >
        重置当前分支到此提交…
      </ContextMenuItem>
      <ContextMenuItem
        description="编辑该提交之后的本地提交"
        disabled={branchOperationDisabled}
        title={branchOperationReason}
        onClick={() => runAndDismiss(() => onRebase(menu.commit))}
      >
        从此提交后交互式变基…
      </ContextMenuItem>
      <ContextMenuDivider />

      <ContextMenuItem
        description="以该提交为起点创建并切换分支"
        onClick={() => runAndDismiss(() => onCreateBranch(menu.commit))}
      >
        创建并检出分支…
      </ContextMenuItem>
      <ContextMenuItem
        description="标签起点固定为该提交"
        onClick={() => runAndDismiss(() => onCreateTag(menu.commit))}
      >
        在此外创建标签…
      </ContextMenuItem>
      <ContextMenuDivider />

      <ContextMenuItem
        description="进入分离头指针，不影响现有分支"
        onClick={() => runAndDismiss(() => onCheckout(menu.commit))}
      >
        检出此提交
      </ContextMenuItem>
      <ContextMenuItem
        description="复制未缩写的提交哈希"
        onClick={() => runAndDismiss(() => onCopy(menu.commit))}
      >
        复制完整哈希
      </ContextMenuItem>
    </ContextMenuSurface>
  )
}
