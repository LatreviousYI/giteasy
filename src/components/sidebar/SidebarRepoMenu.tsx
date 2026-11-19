import {
  Check,
  ChevronRight,
  FolderGit2,
  FolderOpen,
  FolderSearch,
  Plus,
  Settings2,
  Terminal
} from 'lucide-react'
import type { RecentRepo } from '../../lib/types'

const menuButtonClass =
  'w-full text-left px-2 py-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[12px] flex items-center gap-2'

interface SidebarRepoMenuProps {
  repoPath: string
  recent: RecentRepo[]
  onDismiss: () => void
  onOpenRecent: (path: string) => void | Promise<void>
  onOpenDirectory: () => void | Promise<void>
  onInitializeRepository: () => void | Promise<void>
  onDiscoverRepositories: () => void | Promise<void>
  onManageRemotes: () => void | Promise<void>
  onOpenTerminal: () => void | Promise<void>
  onCloseRepository: () => void | Promise<void>
}

export default function SidebarRepoMenu({
  repoPath,
  recent,
  onDismiss,
  onOpenRecent,
  onOpenDirectory,
  onInitializeRepository,
  onDiscoverRepositories,
  onManageRemotes,
  onOpenTerminal,
  onCloseRepository
}: SidebarRepoMenuProps) {
  const run = (action: () => void | Promise<void>) => {
    onDismiss()
    void action()
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onDismiss} />
      <div
        className="absolute left-2 right-2 top-[52px] z-40 rounded-[10px] p-1.5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-pop)'
        }}
      >
        <div className="px-2 pt-1 pb-1 text-[10.5px] uppercase tracking-wider text-[var(--text-subtle)]">
          最近仓库
        </div>
        {recent.slice(0, 6).map((item) => (
          <button
            key={item.path}
            className={menuButtonClass}
            onClick={() => run(() => onOpenRecent(item.path))}
          >
            <FolderGit2 size={13} className="text-subtle" />
            <span className="truncate flex-1">{item.name}</span>
            {item.path === repoPath && <Check size={12} className="text-[var(--accent)]" />}
          </button>
        ))}
        <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
        <button className={menuButtonClass} onClick={() => run(onOpenDirectory)}>
          <FolderOpen size={13} className="text-subtle" />
          打开其他仓库…
        </button>
        <button className={menuButtonClass} onClick={() => run(onInitializeRepository)}>
          <Plus size={13} className="text-subtle" />
          初始化新仓库…
        </button>
        <button className={menuButtonClass} onClick={() => run(onDiscoverRepositories)}>
          <FolderSearch size={13} className="text-subtle" />
          扫描子仓库…
        </button>
        <button className={menuButtonClass} onClick={() => run(onManageRemotes)}>
          <Settings2 size={13} className="text-subtle" />
          管理远程…
        </button>
        <button className={menuButtonClass} onClick={() => run(onOpenTerminal)}>
          <Terminal size={13} className="text-subtle" />
          在终端中打开
        </button>
        <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
        <button
          className={`${menuButtonClass} text-[var(--text-muted)]`}
          onClick={() => run(onCloseRepository)}
        >
          <ChevronRight size={13} />
          关闭当前仓库
        </button>
      </div>
    </>
  )
}
