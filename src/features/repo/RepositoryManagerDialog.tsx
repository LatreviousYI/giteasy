import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FolderGit2, FolderSearch, Pencil, Trash2, Users } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useRecentRepos } from '../../lib/queries'
import { pickDirectory, useOpenRepo } from '../../lib/actions'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import { PromptDialog } from '../../components/Dialogs'

export default function RepositoryManagerDialog() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setRepoManagerOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const openRepo = useOpenRepo()
  const { data: recent = [], refetch: refetchRecent } = useRecentRepos()
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null)
  const statsQuery = useQuery({
    queryKey: ['repoStats', repo?.path],
    queryFn: () => ipc.repoStats(repo!.path),
    enabled: !!repo
  })

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <FolderGit2 size={15} />
          Repository Manager
        </span>
      }
      onClose={close}
      footer={
        <>
          <button
            className="btn"
            onClick={async () => {
              const root = await pickDirectory('选择扫描目录')
              if (!root) return
              try {
                const repos = await ipc.repoDiscover(root)
                if (repos[0]) await openRepo(repos[0])
                toast('success', `发现 ${repos.length} 个仓库`)
              } catch (error) {
                errorToast(error)
              }
            }}
          >
            <FolderSearch size={13} />
            扫描仓库
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={close}>
            关闭
          </button>
        </>
      }
    >
      <div className="grid grid-cols-5 gap-2">
        {[
          ['Commits', statsQuery.data?.commits],
          ['Branches', statsQuery.data?.branches],
          ['Tags', statsQuery.data?.tags],
          ['Contributors', statsQuery.data?.contributors],
          ['Tracked files', statsQuery.data?.trackedFiles]
        ].map(([label, value]) => (
          <div key={String(label)} className="detail-block">
            <b>{label}</b>
            <div className="mt-1" style={{ fontSize: 18 }}>
              {value ?? '-'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label mb-2">最近仓库</div>
          {recent.length === 0 ? (
            <Empty title="暂无最近仓库" />
          ) : (
            recent.map((item) => (
              <div key={item.path} className="github-list-row">
                <FolderGit2 size={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="github-list-title">{item.name}</div>
                  <div className="github-list-sub mono">{item.path}</div>
                </div>
                <button className="btn btn-sm" onClick={() => void openRepo(item.path)}>
                  打开
                </button>
                <button
                  className="icon-btn"
                  title="重命名"
                  onClick={() => setRenameTarget(item)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="icon-btn"
                  title="从最近移除"
                  onClick={async () => {
                    await ipc.repoForget(item.path)
                    toast('success', '已从最近仓库移除')
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="label mb-2">主要贡献者</div>
          {statsQuery.isLoading ? (
            <Spinner />
          ) : statsQuery.data?.topContributors.length ? (
            statsQuery.data.topContributors.map((contributor) => (
              <div key={contributor.name} className="github-list-row">
                <Users size={13} />
                <span className="truncate" style={{ flex: 1 }}>
                  {contributor.name}
                </span>
                <span className="row-sub">{contributor.commits}</span>
              </div>
            ))
          ) : (
            <div className="text-[11.5px] text-[var(--text-subtle)]">暂无统计</div>
          )}
        </div>
      </div>
      <PromptDialog
        open={!!renameTarget}
        title="重命名仓库"
        label="显示名称"
        defaultValue={renameTarget?.name ?? ''}
        onSubmit={async (value) => {
          if (!renameTarget) return
          await ipc.repoRenameRecent(renameTarget.path, value)
          setRenameTarget(null)
          await refetchRecent()
        }}
        onCancel={() => setRenameTarget(null)}
      />
    </Modal>
  )
}
