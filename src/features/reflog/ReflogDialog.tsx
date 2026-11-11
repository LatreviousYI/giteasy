import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows, RotateCcw } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import { relativeTime } from '../../lib/format'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import { ConfirmDialog } from '../../components/Dialogs'

export default function ReflogDialog({
  onClose,
  onCompare
}: {
  onClose: () => void
  onCompare: (oid: string) => void
}) {
  const repo = useApp((s) => s.repo)
  const setRepo = useApp((s) => s.setRepo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [busy, setBusy] = useState(false)

  const query = useQuery({
    queryKey: ['reflog', repo?.path],
    queryFn: () => ipc.reflogList(repo!.path, 200),
    enabled: !!repo
  })

  if (!repo) return null
  const entries = query.data ?? []
  const current = entries.find((entry) => entry.oid === selected) ?? null

  const restore = async () => {
    if (!current) return
    setBusy(true)
    try {
      await ipc.reset(repo.path, current.oid, 'hard')
      const info = await ipc.repoOpen(repo.path)
      setRepo(info)
      invalidate()
      toast('success', `已恢复到 ${current.shortOid}`)
      setConfirmRestore(false)
      onClose()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        wide
        title="Reflog 历史恢复"
        onClose={onClose}
        footer={
          <>
            <span className="text-[11px] text-[var(--text-subtle)]">
              Reflog 可用于找回误删或重置的提交
            </span>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              关闭
            </button>
            <button
              className="btn"
              disabled={!current}
              onClick={() => current && onCompare(current.oid)}
            >
              <GitCompareArrows size={13} />
              比较
            </button>
            <button
              className="btn btn-danger"
              disabled={!current || busy}
              onClick={() => setConfirmRestore(true)}
            >
              <RotateCcw size={13} />
              恢复到此状态
            </button>
          </>
        }
      >
        <div style={{ maxHeight: '58vh', overflow: 'auto', margin: -16 }}>
          {query.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : entries.length === 0 ? (
            <Empty title="暂无 Reflog" subtitle="当前仓库没有可恢复的历史记录。" />
          ) : (
            <div className="p-2">
              {entries.map((entry) => (
                <div
                  key={`${entry.selector}-${entry.oid}`}
                  className={`list-row ${selected === entry.oid ? 'active' : ''}`}
                  onClick={() => setSelected(entry.oid)}
                  title={entry.oid}
                >
                  <span className="mono text-[11px] text-[var(--text-subtle)]">
                    {entry.selector}
                  </span>
                  <span className="mono text-[11px]">{entry.shortOid}</span>
                  <span className="truncate" style={{ flex: 1 }}>
                    {entry.action}
                  </span>
                  <span className="row-sub">{relativeTime(entry.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRestore}
        title="恢复到 Reflog 状态"
        danger
        confirmLabel="硬重置并恢复"
        busy={busy}
        message={
          <div>
            <p style={{ marginTop: 0 }}>
              将执行 <span className="mono">git reset --hard {current?.shortOid}</span>。
            </p>
            <p style={{ marginBottom: 0 }}>
              暂存区和工作区未提交改动会丢失。建议先提交或储藏当前改动。
            </p>
          </div>
        }
        onCancel={() => setConfirmRestore(false)}
        onConfirm={restore}
      />
    </>
  )
}
