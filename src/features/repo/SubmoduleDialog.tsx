import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import type { SubmoduleDto } from '../../lib/types'
import Modal from '../../components/Modal'

export default function SubmoduleDialog({
  submodule,
  onClose
}: {
  submodule?: SubmoduleDto | null
  onClose: () => void
}) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const [url, setUrl] = useState(submodule?.url ?? '')
  const [target, setTarget] = useState(submodule?.path ?? '')
  const [newPath, setNewPath] = useState(submodule?.path ?? '')
  const [busy, setBusy] = useState(false)
  const editing = !!submodule

  if (!repo) return null

  const submit = async () => {
    setBusy(true)
    try {
      if (editing) {
        if (newPath.trim() && newPath.trim() !== submodule.path) {
          await ipc.submoduleMove(repo.path, submodule.path, newPath.trim())
        }
        toast('success', 'Submodule 已更新')
      } else {
        await ipc.submoduleAdd(repo.path, url.trim(), target.trim())
        toast('success', 'Submodule 已添加')
      }
      invalidate()
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
          <Boxes size={15} />
          {editing ? '移动 Submodule' : '添加 Submodule'}
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
            disabled={
              busy ||
              (editing
                ? !newPath.trim()
                : !url.trim() || !target.trim())
            }
            onClick={submit}
          >
            {busy ? '处理中…' : editing ? '移动' : '添加'}
          </button>
        </>
      }
    >
      {!editing && (
        <>
          <div className="field">
            <label className="label">仓库 URL</label>
            <input
              className="input mono"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="git@github.com:org/repo.git"
            />
          </div>
          <div className="field">
            <label className="label">目标路径</label>
            <input
              className="input mono"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="vendor/repo"
            />
          </div>
        </>
      )}
      {editing && (
        <>
          <div className="field">
            <label className="label">当前路径</label>
            <input className="input mono" value={submodule.path} readOnly />
          </div>
          <div className="field">
            <label className="label">新路径</label>
            <input
              className="input mono"
              value={newPath}
              onChange={(event) => setNewPath(event.target.value)}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
