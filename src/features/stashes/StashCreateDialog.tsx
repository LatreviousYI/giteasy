import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckSquare, Square } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import type { FileStatus } from '../../lib/types'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'

function fileBadge(file: FileStatus) {
  if (file.conflicted) return '!'
  if (file.worktree === 'untracked') return 'U'
  if (file.staged && file.unstaged) return 'M*'
  if (file.staged) return 'S'
  return 'M'
}

export default function StashCreateDialog({
  repoPath,
  files,
  onClose,
  onChanged
}: {
  repoPath: string
  files: FileStatus[]
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useApp((state) => state.toast)
  const errorToast = useApp((state) => state.errorToast)
  const selectable = useMemo(() => files.filter((file) => !file.conflicted), [files])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelected(new Set(selectable.map((file) => file.path)))
  }, [selectable])

  const toggle = (path: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allSelected =
    selectable.length > 0 && selectable.every((file) => selected.has(file.path))
  const selectedFiles = selectable.filter((file) => selected.has(file.path))
  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(selectable.map((file) => file.path))
    )
  }

  const create = async () => {
    if (!selectedFiles.length || busy) return
    setBusy(true)
    try {
      const includeUntracked = selectedFiles.some(
        (file) => file.worktree === 'untracked'
      )
      await ipc.stashSave(
        repoPath,
        message.trim() || null,
        includeUntracked,
        selectedFiles.map((file) => file.path)
      )
      toast(
        'success',
        selectedFiles.length === selectable.length
          ? '已储藏全部改动'
          : `已储藏 ${selectedFiles.length} 个文件`
      )
      onChanged()
      onClose()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Archive size={15} />
          储藏选中的文件
        </span>
      }
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <span className="text-[11px] text-[var(--text-subtle)]">
            已选择 {selectedFiles.length} / {selectable.length} 个文件
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void create()}
            disabled={busy || selectedFiles.length === 0}
          >
            {busy ? '储藏中…' : '创建储藏'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">储藏说明（可选）</label>
        <input
          className="input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="wip: 描述"
          autoFocus
          disabled={busy}
        />
      </div>

      <div className="stash-picker-head">
        <span>选择文件</span>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={toggleAll} disabled={busy || !selectable.length}>
          {allSelected ? <Square size={12} /> : <CheckSquare size={12} />}
          {allSelected ? '全不选' : '全选'}
        </button>
      </div>

      <div className="stash-file-list">
        {files.length === 0 && (
          <div className="stash-file-empty">当前没有可储藏的改动。</div>
        )}
        {files.map((file) => {
          const checked = selected.has(file.path)
          return (
            <label
              key={file.path}
              className={`stash-file-row ${file.conflicted ? 'disabled' : ''}`}
              title={file.conflicted ? '冲突文件需先解决后才能储藏' : file.path}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={busy || file.conflicted}
                onChange={() => toggle(file.path)}
              />
              <span className={`stash-file-badge ${file.conflicted ? 'conflicted' : ''}`}>
                {fileBadge(file)}
              </span>
              <span className="stash-file-path mono">{file.path}</span>
              {file.conflicted && <span className="stash-file-note">待解决冲突</span>}
            </label>
          )
        })}
      </div>
    </Modal>
  )
}
