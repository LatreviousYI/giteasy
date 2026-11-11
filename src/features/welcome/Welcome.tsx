import { useState } from 'react'
import { FolderGit2, FolderOpen, GitBranch, Plus, Clock } from 'lucide-react'
import { useRecentRepos } from '../../lib/queries'
import { useOpenRepo, useInitRepo, pickDirectory } from '../../lib/actions'
import { relativeTime } from '../../lib/format'
import { useApp } from '../../store/app'

export default function Welcome() {
  const { data: recent = [] } = useRecentRepos()
  const openRepo = useOpenRepo()
  const initRepo = useInitRepo()
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)

  const chooseRepo = async () => {
    const path = await pickDirectory('选择 Git 仓库目录')
    if (path) {
      setBusy(true)
      const info = await openRepo(path)
      setBusy(false)
      if (info) toast('success', `已打开 ${info.name}`)
    }
  }

  const createRepo = async () => {
    const path = await pickDirectory('选择用于初始化仓库的目录')
    if (path) {
      setBusy(true)
      const info = await initRepo(path)
      setBusy(false)
      if (info) toast('success', `已在 ${info.name} 初始化仓库`)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <GitBranch size={30} />
        </div>
        <h1>GitEasy</h1>
        <p>
          为 Linux 打造的现代 Git 客户端。
          <br />
          打开一个仓库，开始更优雅地管理你的代码历史。
        </p>

        <div className="flex items-center gap-3 mt-1">
          <button className="btn btn-primary" onClick={chooseRepo} disabled={busy}>
            <FolderOpen size={15} />
            打开仓库
          </button>
          <button className="btn" onClick={createRepo} disabled={busy}>
            <Plus size={15} />
            初始化仓库
          </button>
        </div>

        <div className="w-full mt-5">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
            <Clock size={12} />
            最近打开
          </div>
          {recent.length === 0 ? (
            <div
              className="rounded-[12px] border border-dashed px-4 py-6 text-center text-[12px] text-[var(--text-subtle)]"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              还没有最近打开的仓库。选择一个包含 <span className="mono">.git</span> 的目录开始。
            </div>
          ) : (
            <div className="recent-grid">
              {recent.map((item) => (
                <button
                  key={item.path}
                  className="recent-card"
                  onClick={() => openRepo(item.path)}
                >
                  <div className="name">
                    <FolderGit2 size={14} className="text-[var(--accent)]" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="path" title={item.path}>
                    {item.path}
                  </div>
                  <div className="text-[10.5px] text-[var(--text-subtle)] mt-1">
                    {relativeTime(item.lastOpened)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-[var(--text-subtle)] mt-2">
          提示：按 <span className="kbd">Ctrl</span> + <span className="kbd">K</span> 打开命令面板
        </div>
      </div>
    </div>
  )
}
