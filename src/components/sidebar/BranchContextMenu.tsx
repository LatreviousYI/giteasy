import type { ReactNode } from 'react'
import { resolveTrackedRemote, type TrackedRemoteBranch } from '../../lib/branch'
import type { BranchDto, RemoteDto } from '../../lib/types'

export type BranchMenuState =
  | { x: number; y: number; scope: 'local'; branch: BranchDto }
  | { x: number; y: number; scope: 'remote'; branch: BranchDto; remote: RemoteDto }

interface BranchContextMenuProps {
  menu: BranchMenuState
  remoteNames: string[]
  onDismiss: () => void
  onCreateFromRemote: (branch: BranchDto, remote: RemoteDto) => void
  onCheckout: (branch: BranchDto) => void
  onPull: (branch: BranchDto, tracked: TrackedRemoteBranch) => void
  onMerge: (branch: BranchDto) => void
  onPush: (branch: BranchDto) => void
  onSetUpstream: (branch: BranchDto) => void
  onCancelUpstream: (branch: BranchDto) => void
  onRename: (branch: BranchDto) => void
  onDelete: (branch: BranchDto) => void
}

interface MenuItemProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
}

function MenuItem({ children, onClick, disabled, title, danger }: MenuItemProps) {
  return (
    <button
      className={`w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--surface-hover)] text-[12px] disabled:opacity-45 disabled:cursor-not-allowed ${danger ? 'danger-text' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function BranchContextMenu({
  menu,
  remoteNames,
  onDismiss,
  onCreateFromRemote,
  onCheckout,
  onPull,
  onMerge,
  onPush,
  onSetUpstream,
  onCancelUpstream,
  onRename,
  onDelete
}: BranchContextMenuProps) {
  const tracked =
    menu.scope === 'local' ? resolveTrackedRemote(menu.branch.upstream, remoteNames) : null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onMouseDown={onDismiss}
        onContextMenu={(event) => {
          event.preventDefault()
          onDismiss()
        }}
      />
      <div
        className="fixed z-50 min-w-[190px] rounded-[10px] p-1.5"
        style={{
          left: menu.x,
          top: menu.y,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-pop)'
        }}
      >
        {menu.scope === 'remote' ? (
          <>
            <div className="px-2.5 py-1.5 text-[10.5px] text-[var(--text-subtle)]">
              {menu.remote.name} / {menu.branch.name.slice(menu.remote.name.length + 1)}
            </div>
            <MenuItem
              onClick={() => {
                onCreateFromRemote(menu.branch, menu.remote)
                onDismiss()
              }}
            >
              创建本地分支…
            </MenuItem>
          </>
        ) : (
          <>
            {!menu.branch.isHead && (
              <MenuItem
                onClick={() => {
                  onCheckout(menu.branch)
                  onDismiss()
                }}
              >
                检出分支
              </MenuItem>
            )}
            <MenuItem
              disabled={!tracked}
              title={tracked ? `拉取 ${tracked.remote}/${tracked.branch}` : '该分支没有追踪上游'}
              onClick={() => {
                if (!tracked) return
                onPull(menu.branch, tracked)
                onDismiss()
              }}
            >
              {tracked ? '拉取对应远程分支' : '拉取对应远程分支（无追踪上游）'}
            </MenuItem>
            <MenuItem
              onClick={() => {
                onMerge(menu.branch)
                onDismiss()
              }}
            >
              合并到当前分支
            </MenuItem>
            <MenuItem
              onClick={() => {
                onPush(menu.branch)
                onDismiss()
              }}
            >
              Push 到远程…
            </MenuItem>
            <MenuItem
              onClick={() => {
                onSetUpstream(menu.branch)
                onDismiss()
              }}
            >
              设置上游…
            </MenuItem>
            {menu.branch.upstream && (
              <MenuItem
                onClick={() => {
                  onCancelUpstream(menu.branch)
                  onDismiss()
                }}
              >
                取消上游跟踪
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                onRename(menu.branch)
                onDismiss()
              }}
            >
              重命名…
            </MenuItem>
            <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
            <MenuItem
              danger
              onClick={() => {
                onDelete(menu.branch)
                onDismiss()
              }}
            >
              删除分支…
            </MenuItem>
          </>
        )}
      </div>
    </>
  )
}
