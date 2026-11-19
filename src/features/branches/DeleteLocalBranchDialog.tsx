import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import type { BranchDto } from '../../lib/types'
import type { TrackedRemoteBranch } from '../../lib/branch'

interface DeleteLocalBranchDialogProps {
  branch: BranchDto
  tracked: TrackedRemoteBranch | null
  busy: boolean
  onCancel: () => void
  onConfirm: (deleteRemote: boolean) => void
}

export default function DeleteLocalBranchDialog({
  branch,
  tracked,
  busy,
  onCancel,
  onConfirm
}: DeleteLocalBranchDialogProps) {
  const [deleteRemote, setDeleteRemote] = useState(false)

  useEffect(() => {
    setDeleteRemote(false)
  }, [branch.name, tracked?.remote, tracked?.branch])

  return (
    <Modal
      title="删除本地分支"
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onConfirm(deleteRemote)}
            disabled={busy}
          >
            {busy ? '删除中…' : deleteRemote ? '删除本地和远程' : '删除本地分支'}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        将强制删除本地分支 <span className="mono">{branch.name}</span>
        。若该分支尚未合并，其提交可能失去引用。
      </div>

      {tracked && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={deleteRemote}
            onChange={(event) => setDeleteRemote(event.target.checked)}
            disabled={busy}
          />
          同时删除对应的远程追踪分支
        </label>
      )}

      {tracked && deleteRemote && (
        <div className="text-[11.5px] text-[var(--danger)]">
          将同时删除 <span className="mono">{tracked.remote}</span> 上的{' '}
          <span className="mono">{tracked.branch}</span>，该远程分支无法通过本地操作恢复。
        </div>
      )}
    </Modal>
  )
}
