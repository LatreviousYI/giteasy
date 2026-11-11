import { useState } from 'react'
import { FolderTree } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { pickDirectory } from '../../lib/actions'
import { useApp } from '../../store/app'
import type { BranchDto } from '../../lib/types'
import Modal from '../../components/Modal'

export default function WorktreeDialog({
  branch,
  onClose
}: {
  branch: BranchDto
  onClose: () => void
}) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const suggestedName = branch.name.split('/').at(-1) ?? branch.name
  const [localBranch, setLocalBranch] = useState(suggestedName)
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)

  if (!repo) return null

  const chooseParent = async () => {
    const parent = await pickDirectory('选择 Worktree 父目录')
    if (!parent) return
    const cleanParent = parent.replace(/\/$/, '')
    setDir(`${cleanParent}/${localBranch || suggestedName}`)
  }

  const create = async () => {
    if (!dir.trim() || !localBranch.trim()) return
    setBusy(true)
    try {
      await ipc.worktreeAdd(
        repo.path,
        dir.trim(),
        localBranch.trim(),
        true,
        branch.name
      )
      toast('success', `已创建 Worktree ${localBranch}`)
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
          <FolderTree size={15} />
          从远程分支创建 Worktree
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={create}
            disabled={busy || !dir.trim() || !localBranch.trim()}
          >
            {busy ? '创建中…' : '创建 Worktree'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">远程分支</label>
        <input className="input mono" value={branch.name} readOnly />
      </div>
      <div className="field">
        <label className="label">新本地分支</label>
        <input
          className="input"
          value={localBranch}
          onChange={(event) => setLocalBranch(event.target.value)}
          placeholder={suggestedName}
        />
      </div>
      <div className="field">
        <label className="label">Worktree 目录</label>
        <div className="flex items-center gap-2">
          <input
            className="input mono"
            value={dir}
            onChange={(event) => setDir(event.target.value)}
            placeholder="例如 /home/user/worktrees/feature"
          />
          <button className="btn" onClick={chooseParent}>
            选择父目录…
          </button>
        </div>
      </div>
    </Modal>
  )
}
