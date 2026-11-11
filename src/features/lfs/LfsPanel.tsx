import { useQuery } from '@tanstack/react-query'
import { HardDrive, LockKeyhole, RefreshCw, Unlock } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'

export default function LfsPanel() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setLfsOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const query = useQuery({
    queryKey: ['lfsStatus', repo?.path],
    queryFn: () => ipc.lfsStatus(repo!.path),
    enabled: !!repo
  })

  if (!repo) return null
  const data = query.data

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <HardDrive size={15} />
          Git LFS
        </span>
      }
      onClose={close}
      footer={
        <>
          <span className="text-[11px] text-[var(--text-subtle)]">
            Fetch/Pull/Push 的 LFS 进度会显示在顶部进度条
          </span>
          <span className="spacer" />
          <button className="btn" onClick={() => query.refetch()}>
            <RefreshCw size={13} />
            刷新
          </button>
          <button className="btn btn-primary" onClick={close}>
            关闭
          </button>
        </>
      }
    >
      {query.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : !data?.available ? (
        <Empty
          icon={<HardDrive size={20} />}
          title="未安装 Git LFS"
          subtitle={data?.status || '请先在系统中安装 git-lfs。'}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="detail-block">
              <b>版本</b>
              <div className="mono mt-1">{data.version || 'git-lfs'}</div>
            </div>
            <div className="detail-block">
              <b>锁数量</b>
              <div className="mt-1">{data.locks.length}</div>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              LFS 状态
            </div>
            <pre className="conflict-code" style={{ maxHeight: 180 }}>
              {data.status || '没有待显示的 LFS 状态'}
            </pre>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              文件锁
            </div>
            {data.locks.length === 0 ? (
              <div className="text-[11.5px] text-[var(--text-subtle)]">没有 LFS 文件锁</div>
            ) : (
              data.locks.map((lock) => (
                <div key={lock.id || lock.path} className="list-row">
                  <LockKeyhole size={13} className="text-[var(--warn-fg)]" />
                  <span className="mono truncate" style={{ flex: 1 }}>
                    {lock.path}
                  </span>
                  <span className="row-sub">{lock.owner || '-'}</span>
                  <button
                    className="icon-btn"
                    title="解锁"
                    onClick={async () => {
                      try {
                        await ipc.lfsUnlock(repo.path, lock.id)
                        await query.refetch()
                        toast('success', `已解锁 ${lock.path}`)
                      } catch (error) {
                        errorToast(error)
                      }
                    }}
                  >
                    <Unlock size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
