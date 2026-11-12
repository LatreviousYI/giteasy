import { useMemo, useState } from 'react'
import { FolderTree } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { pickDirectory } from '../../lib/actions'
import { useApp } from '../../store/app'
import type { BranchDto } from '../../lib/types'
import Modal from '../../components/Modal'

type CreateMode = 'new' | 'existing'

function remoteLocalName(branch: BranchDto) {
  if (!branch.isRemote) return branch.name.split('/').at(-1) ?? branch.name
  const [, ...parts] = branch.name.split('/')
  return parts.join('/') || branch.name
}

export default function WorktreeDialog({
  initialBranch,
  branches,
  onClose,
  onCreated
}: {
  initialBranch?: BranchDto | null
  branches: BranchDto[]
  onClose: () => void
  onCreated: () => void
}) {
  const repo = useApp((state) => state.repo)
  const toast = useApp((state) => state.toast)
  const errorToast = useApp((state) => state.errorToast)
  const localBranches = useMemo(
    () => branches.filter((branch) => !branch.isRemote),
    [branches]
  )
  const remoteBranches = useMemo(
    () => branches.filter((branch) => branch.isRemote),
    [branches]
  )
  const existingBranches = localBranches.filter((branch) => !branch.isHead)
  const suggestedName = initialBranch ? remoteLocalName(initialBranch) : 'worktree'
  const [mode, setMode] = useState<CreateMode>('new')
  const [branchName, setBranchName] = useState(suggestedName)
  const [startPoint, setStartPoint] = useState(initialBranch?.name ?? '')
  const [existingBranch, setExistingBranch] = useState(existingBranches[0]?.name ?? '')
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)

  if (!repo) return null

  const directoryName =
    mode === 'new'
      ? branchName.trim().split('/').at(-1) || ''
      : existingBranch.split('/').at(-1) || ''

  const chooseParent = async () => {
    const parent = await pickDirectory('选择 Worktree 父目录')
    if (!parent) return
    const cleanParent = parent.replace(/\/$/, '')
    setDir(`${cleanParent}/${directoryName}`)
  }

  const create = async () => {
    if (!dir.trim() || busy) return
    if (mode === 'new' && !branchName.trim()) return
    if (mode === 'existing' && !existingBranch) return

    setBusy(true)
    try {
      if (mode === 'new') {
        await ipc.worktreeAdd(
          repo.path,
          dir.trim(),
          branchName.trim(),
          true,
          startPoint || null
        )
      } else {
        await ipc.worktreeAdd(
          repo.path,
          dir.trim(),
          existingBranch,
          false,
          null
        )
      }
      toast(
        'success',
        `已创建 Worktree ${mode === 'new' ? branchName.trim() : existingBranch}`
      )
      onCreated()
      onClose()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const canCreate =
    !!dir.trim() &&
    ((mode === 'new' && !!branchName.trim()) ||
      (mode === 'existing' && !!existingBranch))

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <FolderTree size={15} />
          创建 Worktree
        </span>
      }
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void create()}
            disabled={busy || !canCreate}
          >
            {busy ? '创建中…' : '创建 Worktree'}
          </button>
        </>
      }
    >
      <div className="worktree-mode" role="radiogroup" aria-label="Worktree 创建方式">
        <label className={mode === 'new' ? 'selected' : ''}>
          <input
            type="radio"
            name="worktree-mode"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
            disabled={busy}
          />
          新建分支
        </label>
        <label className={mode === 'existing' ? 'selected' : ''}>
          <input
            type="radio"
            name="worktree-mode"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
            disabled={busy || existingBranches.length === 0}
          />
          使用已有本地分支
        </label>
      </div>

      {mode === 'new' ? (
        <>
          <div className="field">
            <label className="label">新本地分支</label>
            <input
              className="input"
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              placeholder="feature/worktree"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label className="label">起点分支或提交</label>
            <select
              className="select"
              value={startPoint}
              onChange={(event) => setStartPoint(event.target.value)}
              disabled={busy}
            >
              <option value="">当前 HEAD</option>
              {localBranches.length > 0 && (
                <optgroup label="本地分支">
                  {localBranches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {remoteBranches.length > 0 && (
                <optgroup label="远程分支">
                  {remoteBranches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </>
      ) : (
        <div className="field">
          <label className="label">已有本地分支</label>
          <select
            className="select"
            value={existingBranch}
            onChange={(event) => setExistingBranch(event.target.value)}
            disabled={busy}
          >
            {existingBranches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label className="label">Worktree 目录</label>
        <div className="flex items-center gap-2">
          <input
            className="input mono"
            value={dir}
            onChange={(event) => setDir(event.target.value)}
            placeholder="例如 /home/user/worktrees/feature"
            disabled={busy}
          />
          <button className="btn" onClick={chooseParent} disabled={busy}>
            选择父目录…
          </button>
        </div>
      </div>
    </Modal>
  )
}
