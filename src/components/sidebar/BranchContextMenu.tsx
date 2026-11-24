import { ContextMenuDivider, ContextMenuItem, ContextMenuSurface } from '../ContextMenu'
import { resolveTrackedRemote, type TrackedRemoteBranch } from '../../lib/branch'
import type { BranchDto, RemoteDto } from '../../lib/types'

export type BranchMenuState =
  | { x: number; y: number; scope: 'local'; branch: BranchDto }
  | { x: number; y: number; scope: 'remote'; branch: BranchDto; remote: RemoteDto }

interface BranchContextMenuProps {
  menu: BranchMenuState
  remoteNames: string[]
  currentBranch: string | null
  currentUpstream: string | null
  operationState: string
  onDismiss: () => void
  onCreateFromRemote: (branch: BranchDto, remote: RemoteDto) => void
  onCheckout: (branch: BranchDto) => void
  onPull: (branch: BranchDto, tracked: TrackedRemoteBranch) => void
  onPullRemote: (branch: BranchDto, remote: RemoteDto) => void
  onMerge: (branch: BranchDto) => void
  onRebase: (branch: BranchDto) => void
  onSquash: (branch: BranchDto) => void
  onCherryPick: (branch: BranchDto) => void
  onReset: (branch: BranchDto) => void
  onCreateTag: (branch: BranchDto) => void
  onDeleteRemote: (branch: BranchDto, remote: RemoteDto) => void
  onPush: (branch: BranchDto) => void
  onSetUpstream: (branch: BranchDto) => void
  onCancelUpstream: (branch: BranchDto) => void
  onRename: (branch: BranchDto) => void
  onDelete: (branch: BranchDto) => void
}

export default function BranchContextMenu({
  menu,
  remoteNames,
  currentBranch,
  currentUpstream,
  operationState,
  onDismiss,
  onCreateFromRemote,
  onCheckout,
  onPull,
  onPullRemote,
  onMerge,
  onRebase,
  onSquash,
  onCherryPick,
  onReset,
  onCreateTag,
  onDeleteRemote,
  onPush,
  onSetUpstream,
  onCancelUpstream,
  onRename,
  onDelete
}: BranchContextMenuProps) {
  const tracked =
    menu.scope === 'local' ? resolveTrackedRemote(menu.branch.upstream, remoteNames) : null
  const operationInProgress = operationState !== 'clean'
  const detached = !currentBranch
  const isCurrentBranch = menu.scope === 'local' && menu.branch.name === currentBranch
  const integrationDisabled = operationInProgress || detached || isCurrentBranch
  const integrationReason = operationInProgress
    ? `仓库正在 ${operationState}，请先完成或中止当前操作`
    : detached
      ? '当前处于分离头指针，请先检出本地分支'
      : isCurrentBranch
        ? '当前分支已经是此分支'
        : undefined
  const canPullCurrent = currentUpstream === menu.branch.name
  const remotePullDisabled = operationInProgress || detached || !canPullCurrent
  const remotePullReason = operationInProgress
    ? `仓库正在 ${operationState}，请先完成或中止当前操作`
    : detached
      ? '当前处于分离头指针，请先检出本地分支'
      : canPullCurrent
        ? `从 ${menu.branch.name} 拉取当前分支`
        : `当前分支未追踪 ${menu.branch.name}`

  const runAndDismiss = (action: () => void) => {
    action()
    onDismiss()
  }

  return (
    <ContextMenuSurface x={menu.x} y={menu.y} className="branch-context-menu" onDismiss={onDismiss}>
      <div className="px-2.5 py-1.5 text-[10.5px] text-[var(--text-subtle)]">
        {menu.scope === 'remote'
          ? `${menu.remote.name} / ${menu.branch.name.slice(menu.remote.name.length + 1)}`
          : menu.branch.name}
      </div>

      {menu.scope === 'remote' ? (
        <>
          <ContextMenuItem
            description="默认去掉远程名前缀，并可选择创建后切换"
            onClick={() => runAndDismiss(() => onCreateFromRemote(menu.branch, menu.remote))}
          >
            创建本地分支…
          </ContextMenuItem>
          <ContextMenuDivider />
        </>
      ) : (
        <>
          {!menu.branch.isHead && (
            <ContextMenuItem
              description={`切换到本地分支 ${menu.branch.name}`}
              disabled={operationInProgress}
              title={operationInProgress ? '请先完成或中止当前操作' : undefined}
              onClick={() => runAndDismiss(() => onCheckout(menu.branch))}
            >
              检出分支
            </ContextMenuItem>
          )}
          <ContextMenuItem
            description={
              tracked ? `从 ${tracked.remote}/${tracked.branch} 拉取` : '该分支没有追踪上游'
            }
            disabled={!tracked || operationInProgress}
            title={
              operationInProgress
                ? '请先完成或中止当前操作'
                : tracked
                  ? `拉取 ${tracked.remote}/${tracked.branch}`
                  : '该分支没有追踪上游'
            }
            onClick={() => {
              if (tracked) runAndDismiss(() => onPull(menu.branch, tracked))
            }}
          >
            拉取对应远程分支
          </ContextMenuItem>
          <ContextMenuDivider />
        </>
      )}

      <ContextMenuItem
        description="保留双方历史，需要时创建合并提交"
        disabled={integrationDisabled}
        title={integrationReason}
        onClick={() => runAndDismiss(() => onMerge(menu.branch))}
      >
        合并到当前分支
      </ContextMenuItem>
      <ContextMenuItem
        description="将当前分支提交重放到此分支之后，会改写历史"
        disabled={integrationDisabled}
        title={integrationReason}
        onClick={() => runAndDismiss(() => onRebase(menu.branch))}
      >
        变基当前分支到此分支
      </ContextMenuItem>
      <ContextMenuItem
        description="将来源分支差异合成一个提交，可编辑提交信息"
        disabled={integrationDisabled}
        title={integrationReason}
        onClick={() => runAndDismiss(() => onSquash(menu.branch))}
      >
        Squash 合并到当前分支…
      </ContextMenuItem>
      <ContextMenuItem
        description={
          menu.scope === 'remote'
            ? '选择该远程分支的提交应用到当前分支'
            : '选择该本地分支的提交应用到当前分支'
        }
        disabled={operationInProgress || detached}
        title={
          operationInProgress
            ? '请先完成或中止当前操作'
            : detached
              ? '当前处于分离头指针'
              : undefined
        }
        onClick={() => runAndDismiss(() => onCherryPick(menu.branch))}
      >
        Cherry-pick 提交…
      </ContextMenuItem>
      <ContextMenuItem
        description="移动当前分支指针，可选择保留或丢弃改动"
        disabled={integrationDisabled}
        title={integrationReason}
        onClick={() => runAndDismiss(() => onReset(menu.branch))}
      >
        重置当前分支到此分支…
      </ContextMenuItem>
      <ContextMenuDivider />

      <ContextMenuItem
        description="标签起点固定为该分支最新提交"
        onClick={() => runAndDismiss(() => onCreateTag(menu.branch))}
      >
        创建标签…
      </ContextMenuItem>

      {menu.scope === 'remote' ? (
        <>
          <ContextMenuItem
            description={
              canPullCurrent ? `更新当前分支 ${currentBranch}` : '当前分支未追踪此远程分支'
            }
            disabled={remotePullDisabled}
            title={remotePullReason}
            onClick={() => runAndDismiss(() => onPullRemote(menu.branch, menu.remote))}
          >
            从该远程分支拉取当前分支
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            danger
            description="从远程服务器删除，无法通过本地操作恢复"
            onClick={() => runAndDismiss(() => onDeleteRemote(menu.branch, menu.remote))}
          >
            删除远程分支…
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem
            description="推送到远程分支或建立上游跟踪"
            onClick={() => runAndDismiss(() => onPush(menu.branch))}
          >
            Push 到远程…
          </ContextMenuItem>
          <ContextMenuItem
            description="为当前分支指定追踪的远程分支"
            onClick={() => runAndDismiss(() => onSetUpstream(menu.branch))}
          >
            设置上游…
          </ContextMenuItem>
          {menu.branch.upstream && (
            <ContextMenuItem
              description="保留分支，只移除本地追踪关系"
              onClick={() => runAndDismiss(() => onCancelUpstream(menu.branch))}
            >
              取消上游跟踪
            </ContextMenuItem>
          )}
          <ContextMenuItem
            description="重命名本地分支引用"
            onClick={() => runAndDismiss(() => onRename(menu.branch))}
          >
            重命名…
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            danger
            description="删除本地分支，可选择同时删除追踪的远程分支"
            onClick={() => runAndDismiss(() => onDelete(menu.branch))}
          >
            删除分支…
          </ContextMenuItem>
        </>
      )}
    </ContextMenuSurface>
  )
}
