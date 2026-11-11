import type { MouseEvent, ReactNode } from 'react'
import {
  Archive,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudUpload,
  FolderTree,
  GitBranch,
  Play,
  Plus,
  RefreshCw,
  Tag as TagIcon,
  Trash2
} from 'lucide-react'
import type {
  BranchDto,
  RemoteDto,
  StashDto,
  SubmoduleDto,
  TagDto,
  WorktreeDto
} from '../../lib/types'
import { splitPath } from '../../lib/format'

export interface SidebarConfirmState {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  action: () => Promise<void>
}

interface BranchSectionProps {
  branches: BranchDto[]
  picked: string | null
  onPick: (value: string) => void
  onCreate: () => void
  onCheckout: (branch: BranchDto) => void
  onContextMenu: (event: MouseEvent<HTMLDivElement>, branch: BranchDto) => void
}

export function BranchSection({
  branches,
  picked,
  onPick,
  onCreate,
  onCheckout,
  onContextMenu
}: BranchSectionProps) {
  return (
    <div className="section">
      <div className="section-head">
        <GitBranch size={12} />
        分支
        <span className="count">{branches.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="新建分支"
          onClick={onCreate}
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="section-body">
        {branches.map((branch) => (
          <div
            key={branch.name}
            className={`list-row ${
              branch.isHead || picked === `local:${branch.name}` ? 'active' : ''
            }`}
            onClick={() => onPick(`local:${branch.name}`)}
            onDoubleClick={() => {
              if (!branch.isHead) onCheckout(branch)
            }}
            onContextMenu={(event) => onContextMenu(event, branch)}
            title={`${branch.subject}\n双击切换分支，右键查看更多操作`}
          >
            <GitBranch
              size={13}
              className={branch.isHead ? 'text-[var(--accent)]' : 'text-subtle'}
            />
            <span className="truncate" style={{ flex: 1 }}>
              {branch.name}
            </span>
            {branch.ahead > 0 && <span className="row-sub">↑{branch.ahead}</span>}
            {branch.behind > 0 && <span className="row-sub">↓{branch.behind}</span>}
            {branch.isHead && <Check size={12} className="text-[var(--accent)]" />}
          </div>
        ))}
      </div>
    </div>
  )
}

interface RemoteSectionProps {
  remotes: RemoteDto[]
  branches: BranchDto[]
  picked: string | null
  collapsed: Record<string, boolean>
  onAdd: () => void
  onToggle: (name: string) => void
  onPick: (value: string) => void
  onCheckout: (branch: BranchDto) => void
  onDeleteRemote: (remote: RemoteDto) => void
  onDeleteBranch: (remote: RemoteDto, branch: BranchDto, shortName: string) => void
}

export function RemoteSection({
  remotes,
  branches,
  picked,
  collapsed,
  onAdd,
  onToggle,
  onPick,
  onCheckout,
  onDeleteRemote,
  onDeleteBranch
}: RemoteSectionProps) {
  return (
    <div className="section">
      <div className="section-head">
        <Cloud size={12} />
        远程
        <span className="count">{remotes.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="添加远程"
          onClick={onAdd}
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="section-body">
        {remotes.length === 0 && (
          <div className="px-2 py-1 text-[11px] text-[var(--text-subtle)]">
            暂无远程，点击 + 添加
          </div>
        )}
        {remotes.map((remote) => {
          const prefix = `${remote.name}/`
          const items = branches
            .filter((branch) => branch.name.startsWith(prefix))
            .map((branch) => ({
              branch,
              shortName: branch.name.slice(prefix.length)
            }))
          const isCollapsed = !!collapsed[remote.name]
          return (
            <div key={remote.name}>
              <div
                className="list-row"
                title={`${remote.url}\n点击展开/收起分支`}
                onClick={() => onToggle(remote.name)}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <Cloud size={12} className="text-subtle" />
                <span className="truncate mono" style={{ flex: 1 }}>
                  {remote.name}
                </span>
                <span className="row-sub">{items.length}</span>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    style={{ width: 20, height: 20 }}
                    title="删除远程"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteRemote(remote)
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {!isCollapsed &&
                items.map(({ branch, shortName }) => (
                  <div
                    key={branch.name}
                    className={`list-row ${
                      picked === `remote:${branch.name}` ? 'active' : ''
                    }`}
                    style={{ paddingLeft: 28 }}
                    onClick={() => onPick(`remote:${branch.name}`)}
                    onDoubleClick={() => onCheckout(branch)}
                    title={`${branch.subject}\n双击检出并跟踪该远程分支`}
                  >
                    <span className="text-subtle text-[10px]">◌</span>
                    <span className="truncate" style={{ flex: 1 }}>
                      {shortName}
                    </span>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        style={{ width: 20, height: 20 }}
                        title="删除远程分支"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteBranch(remote, branch, shortName)
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}

              {!isCollapsed && items.length === 0 && (
                <div
                  className="px-2 py-1 text-[11px] text-[var(--text-subtle)]"
                  style={{ paddingLeft: 28 }}
                >
                  暂无远程分支
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TagSectionProps {
  tags: TagDto[]
  onCreate: () => void
  onCheckout: (tag: TagDto) => void
  onPush: (tag: TagDto) => void
  onDelete: (tag: TagDto) => void
}

export function TagSection({
  tags,
  onCreate,
  onCheckout,
  onPush,
  onDelete
}: TagSectionProps) {
  return (
    <div className="section">
      <div className="section-head">
        <TagIcon size={12} />
        标签
        <span className="count">{tags.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="新建标签"
          onClick={onCreate}
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="section-body">
        {tags.length === 0 && (
          <div className="px-2 py-1 text-[11px] text-[var(--text-subtle)]">
            暂无标签
          </div>
        )}
        {tags.map((tag) => (
          <div key={tag.name} className="list-row" title={tag.message ?? tag.shortOid}>
            <TagIcon size={12} className="text-subtle" />
            <span className="truncate" style={{ flex: 1 }}>
              {tag.name}
            </span>
            <div className="row-actions">
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="检出标签"
                onClick={(event) => {
                  event.stopPropagation()
                  onCheckout(tag)
                }}
              >
                <GitBranch size={12} />
              </button>
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="推送标签到 origin"
                onClick={(event) => {
                  event.stopPropagation()
                  onPush(tag)
                }}
              >
                <CloudUpload size={12} />
              </button>
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="删除标签"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(tag)
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface StashSectionProps {
  stashes: StashDto[]
  onCreate: () => void
  onPreview: (stash: StashDto) => void
  onPop: (stash: StashDto) => void
  onDelete: (stash: StashDto) => void
}

export function StashSection({
  stashes,
  onCreate,
  onPreview,
  onPop,
  onDelete
}: StashSectionProps) {
  return (
    <div className="section">
      <div className="section-head">
        <Archive size={12} />
        储藏
        <span className="count">{stashes.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="储藏当前改动"
          onClick={onCreate}
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="section-body">
        {stashes.length === 0 && (
          <div className="px-2 py-1 text-[11px] text-[var(--text-subtle)]">
            暂无储藏
          </div>
        )}
        {stashes.map((stash) => (
          <div
            key={stash.oid}
            className="list-row"
            onClick={() => onPreview(stash)}
            title={stash.message}
          >
            <Archive size={12} className="text-subtle" />
            <span className="truncate" style={{ flex: 1 }}>
              {stash.message.replace(/^WIP on [^:]+:\s*/, '') || stash.shortOid}
            </span>
            <button
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              title="应用并删除"
              onClick={(event) => {
                event.stopPropagation()
                onPop(stash)
              }}
            >
              <Play size={12} />
            </button>
            <button
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              title="删除储藏"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(stash)
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SubmoduleSectionProps {
  submodules: SubmoduleDto[]
  onUpdate: () => void
}

export function SubmoduleSection({ submodules, onUpdate }: SubmoduleSectionProps) {
  if (submodules.length === 0) return null
  return (
    <div className="section">
      <div className="section-head">
        <Boxes size={12} />
        子模块
        <span className="count">{submodules.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="更新全部子模块"
          onClick={onUpdate}
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="section-body">
        {submodules.map((submodule) => (
          <div key={submodule.path} className="list-row" title={submodule.url}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  submodule.status === 'clean' ? 'var(--add-fg)' : 'var(--warn-fg)'
              }}
            />
            <span className="truncate" style={{ flex: 1 }}>
              {submodule.path}
            </span>
            <span className="row-sub">{submodule.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface WorktreeSectionProps {
  worktrees: WorktreeDto[]
  repoPath: string
  onAdd: () => void
  onRemove: (worktree: WorktreeDto) => void
}

export function WorktreeSection({
  worktrees,
  repoPath,
  onAdd,
  onRemove
}: WorktreeSectionProps) {
  return (
    <div className="section">
      <div className="section-head">
        <FolderTree size={12} />
        工作树
        <span className="count">{worktrees.length}</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          title="添加工作树"
          onClick={onAdd}
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="section-body">
        {worktrees.map((worktree) => (
          <div key={worktree.path} className="list-row" title={worktree.path}>
            <FolderTree size={12} className="text-subtle" />
            <span className="truncate" style={{ flex: 1 }}>
              {worktree.branch ?? splitPath(worktree.path).name}
            </span>
            {worktree.path !== repoPath && (
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="移除工作树"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(worktree)
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
