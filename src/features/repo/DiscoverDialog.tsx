import { useEffect, useState } from 'react'
import { FolderGit2, RefreshCw } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { useOpenRepo } from '../../lib/actions'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'

export default function DiscoverDialog({
  root,
  onClose
}: {
  root: string
  onClose: () => void
}) {
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const openRepo = useOpenRepo()
  const [repos, setRepos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const scan = () => {
    setLoading(true)
    ipc
      .repoDiscover(root)
      .then((result) => setRepos(result))
      .catch(errorToast)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root])

  const open = async (path: string) => {
    const info = await openRepo(path)
    if (info) {
      toast('success', `已打开 ${info.name}`)
      onClose()
    }
  }

  return (
    <Modal
      title="发现子仓库"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={scan} disabled={loading}>
            <RefreshCw size={14} />
            重新扫描
          </button>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </>
      }
    >
      <div className="text-[11.5px] text-[var(--text-muted)]">
        扫描目录：<span className="mono">{root}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-[var(--text-muted)]">
          <Spinner /> 正在扫描（最多 3 层）…
        </div>
      ) : repos.length === 0 ? (
        <Empty
          icon={<FolderGit2 size={20} />}
          title="没有发现 Git 仓库"
          subtitle="该目录及其子目录中没有找到包含 .git 的仓库。"
        />
      ) : (
        <div className="flex flex-col gap-1" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {repos.map((path) => (
            <div key={path} className="list-row" onClick={() => open(path)} title={path}>
              <FolderGit2 size={14} className="text-[var(--accent)]" />
              <span className="truncate" style={{ flex: 1 }}>
                {path.split('/').filter(Boolean).slice(-1)[0]}
              </span>
              <span className="text-[10.5px] text-[var(--text-subtle)] truncate" style={{ maxWidth: 320 }}>
                {path}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
