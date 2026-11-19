import { useEffect, useId, useState } from 'react'
import Modal from '../../components/Modal'
import { remoteBranchShortName } from '../../lib/branch'
import type { BranchDto, RemoteDto } from '../../lib/types'

interface RemoteBranchCreateDialogProps {
  branch: BranchDto
  remote: RemoteDto
  existingLocalNames: string[]
  busy: boolean
  onCancel: () => void
  onSubmit: (name: string, checkout: boolean) => void
}

export default function RemoteBranchCreateDialog({
  branch,
  remote,
  existingLocalNames,
  busy,
  onCancel,
  onSubmit
}: RemoteBranchCreateDialogProps) {
  const inputId = useId()
  const [name, setName] = useState(() => remoteBranchShortName(remote.name, branch.name))
  const [checkout, setCheckout] = useState(true)

  useEffect(() => {
    setName(remoteBranchShortName(remote.name, branch.name))
    setCheckout(true)
  }, [branch.name, remote.name])

  const trimmed = name.trim()
  const existsLocally = existingLocalNames.includes(trimmed)
  const blocked = existsLocally && !checkout

  return (
    <Modal
      title="从远程分支创建本地分支"
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => trimmed && !blocked && onSubmit(trimmed, checkout)}
            disabled={busy || !trimmed || blocked}
          >
            {busy ? '处理中…' : existsLocally && checkout ? '切换到现有分支' : '创建分支'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor={inputId}>
          本地分支名称
        </label>
        <input
          id={inputId}
          className="input mono"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmed && !blocked) onSubmit(trimmed, checkout)
          }}
        />
      </div>

      <div className="text-[11px] text-[var(--text-subtle)]">
        基于 <span className="mono">{branch.name}</span> 创建，远程名前缀不会包含在默认名称中。
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={checkout}
          onChange={(event) => setCheckout(event.target.checked)}
          disabled={busy}
        />
        创建成功后切换到该分支
      </label>

      {existsLocally && (
        <div className="text-[11.5px] text-[var(--warn-fg)]">
          {checkout
            ? '同名本地分支已存在，将切换到现有分支。'
            : '同名本地分支已存在；勾选切换后才能继续。'}
        </div>
      )}
    </Modal>
  )
}
