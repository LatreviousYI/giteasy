import { useId, useState } from 'react'
import { Tag as TagIcon } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'

interface TagDialogProps {
  onClose: () => void
  startPoint?: string | null
  sourceLabel?: string | null
}

export default function TagDialog({ onClose, startPoint, sourceLabel }: TagDialogProps) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const nameId = useId()
  const messageId = useId()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!repo) return null

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await ipc.tagCreate(repo.path, name.trim(), message.trim() || null, startPoint ?? null)
      invalidate()
      toast('success', `已创建标签 ${name.trim()}`)
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
          <TagIcon size={15} />
          新建标签
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !name.trim()}>
            {busy ? '创建中…' : '创建'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor={nameId}>
          标签名称
        </label>
        <input
          id={nameId}
          className="input"
          autoFocus
          value={name}
          placeholder="v1.0.0"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') create()
          }}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor={messageId}>
          标签说明（可选，填写后创建附注标签）
        </label>
        <textarea
          id={messageId}
          className="textarea"
          value={message}
          placeholder="例如：首个稳定版本"
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      <div className="text-[11px] text-[var(--text-subtle)]">
        标签将创建在 <span className="mono">{sourceLabel ?? startPoint ?? '当前 HEAD'}</span>
        上；留空说明则为轻量标签。
      </div>
    </Modal>
  )
}
