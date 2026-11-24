import { useEffect, useState } from 'react'
import { GitMerge } from 'lucide-react'
import Modal from '../../components/Modal'

interface SquashMergeDialogProps {
  source: string
  target: string
  busy: boolean
  onCancel: () => void
  onSubmit: (message: string) => void
}

function defaultMessage(source: string, target: string) {
  return `Squash merge ${source} into ${target}`
}

export default function SquashMergeDialog({
  source,
  target,
  busy,
  onCancel,
  onSubmit
}: SquashMergeDialogProps) {
  const [message, setMessage] = useState(() => defaultMessage(source, target))
  const trimmed = message.trim()

  useEffect(() => {
    setMessage(defaultMessage(source, target))
  }, [source, target])

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <GitMerge size={15} />
          Squash 合并到当前分支
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => trimmed && onSubmit(trimmed)}
            disabled={busy || !trimmed}
          >
            {busy ? '合并中…' : 'Squash 并提交'}
          </button>
        </>
      }
    >
      <div className="branch-action-summary">
        <span>
          来源：<b className="mono">{source}</b>
        </span>
        <span>
          目标：<b className="mono">{target}</b>
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="squash-commit-message">
          最终提交信息
        </label>
        <textarea
          id="squash-commit-message"
          className="textarea"
          autoFocus
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={busy}
        />
      </div>
      <div className="text-[11px] text-[var(--text-subtle)]">
        来源分支的全部差异会暂存，并在确认后创建为当前分支上的一个提交。
      </div>
    </Modal>
  )
}
