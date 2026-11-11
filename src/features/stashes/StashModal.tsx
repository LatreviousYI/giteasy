import { useEffect, useState } from 'react'
import { Archive, Play, Trash2 } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import type { DiffDto, StashDto } from '../../lib/types'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import DiffViewer from '../diff/DiffViewer'

export default function StashModal({
  repoPath,
  stash,
  onClose,
  onChanged
}: {
  repoPath: string
  stash: StashDto
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const [diffs, setDiffs] = useState<DiffDto[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ipc
      .stashDiff(repoPath, stash.oid)
      .then((result) => {
        if (cancelled) return
        setDiffs(result)
        setSelected(result[0]?.path ?? null)
      })
      .catch(errorToast)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [repoPath, stash.oid])

  const diff = diffs.find((item) => item.path === selected) ?? null

  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      toast('success', message)
      onChanged()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <Archive size={15} />
          储藏 stash@{stash.index}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="mono text-[11px] text-[var(--text-subtle)]">{stash.shortOid}</span>
          <span className="spacer" />
          <button
            className="btn"
            disabled={busy}
            onClick={() => act(() => ipc.stashDrop(repoPath, stash.index), '已删除储藏')}
          >
            <Trash2 size={14} />
            删除
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => act(() => ipc.stashApply(repoPath, stash.index, false), '已应用储藏')}
          >
            应用
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => act(() => ipc.stashApply(repoPath, stash.index, true), '已弹出储藏')}
          >
            <Play size={14} />
            弹出
          </button>
        </>
      }
    >
      <div className="flex" style={{ height: '58vh', margin: -16 }}>
        <div
          style={{
            width: 240,
            flex: '0 0 240px',
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 8
          }}
        >
          {loading && (
            <div className="flex items-center gap-2 px-2 py-2 text-[12px] text-[var(--text-muted)]">
              <Spinner /> 读取中…
            </div>
          )}
          {!loading && diffs.length === 0 && (
            <div className="px-2 py-2 text-[12px] text-[var(--text-subtle)]">没有文件改动</div>
          )}
          {diffs.map((item) => (
            <div
              key={item.path}
              className={`detail-file ${selected === item.path ? 'active' : ''}`}
              onClick={() => setSelected(item.path)}
            >
              <span className="path">{item.path}</span>
              <span className="add-count">+{item.additions}</span>
              <span className="del-count">-{item.deletions}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {diff ? (
            <DiffViewer
              diff={diff}
              layout="unified"
              onLayoutChange={() => undefined}
              showLayoutToggle={false}
            />
          ) : (
            <Empty icon={<Archive size={20} />} title="选择文件查看储藏内容" />
          )}
        </div>
      </div>
    </Modal>
  )
}
