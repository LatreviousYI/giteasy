import { useEffect, useState, type ReactNode } from 'react'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  danger,
  busy,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>{message}</div>
    </Modal>
  )
}

interface PromptDialogProps {
  open: boolean
  title: string
  label: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  busy?: boolean
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel = '确定',
  busy,
  onSubmit,
  onCancel
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  if (!open) return null

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={busy || !value.trim()}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">{label}</label>
        <input
          className="input"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) onSubmit(value.trim())
          }}
        />
      </div>
    </Modal>
  )
}
