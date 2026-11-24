import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import Modal from '../../components/Modal'

export type ResetMode = 'soft' | 'mixed' | 'hard'

interface ResetBranchDialogProps {
  currentBranch: string
  target: string
  targetOid: string
  busy: boolean
  onCancel: () => void
  onSubmit: (mode: ResetMode) => void
}

const MODES: Array<{ value: ResetMode; label: string; description: string }> = [
  {
    value: 'soft',
    label: 'Soft',
    description: '移动当前分支，保留暂存区和工作区改动'
  },
  {
    value: 'mixed',
    label: 'Mixed',
    description: '移动当前分支并清空暂存区，保留工作区改动'
  },
  {
    value: 'hard',
    label: 'Hard',
    description: '移动当前分支并丢弃暂存区与工作区改动'
  }
]

export default function ResetBranchDialog({
  currentBranch,
  target,
  targetOid,
  busy,
  onCancel,
  onSubmit
}: ResetBranchDialogProps) {
  const [mode, setMode] = useState<ResetMode>('mixed')

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <RotateCcw size={15} />
          重置当前分支
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
            className={`btn ${mode === 'hard' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onSubmit(mode)}
            disabled={busy}
          >
            {busy ? '重置中…' : mode === 'hard' ? '丢弃改动并重置' : '执行重置'}
          </button>
        </>
      }
    >
      <div className="branch-action-summary">
        <span>
          当前分支：<b className="mono">{currentBranch}</b>
        </span>
        <span>
          重置到：<b className="mono">{target}</b> ({targetOid.slice(0, 7)})
        </span>
      </div>

      <div className="reset-mode-list" role="radiogroup" aria-label="Reset 模式">
        {MODES.map((option) => (
          <label
            key={option.value}
            className={`check-row reset-mode-option ${
              mode === 'hard' && option.value === 'hard' ? 'danger-text' : ''
            }`}
          >
            <input
              type="radio"
              name="reset-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              disabled={busy}
            />
            <span>
              <b>{option.label}</b>
              <span className="block text-[11px] text-[var(--text-subtle)]">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'hard' && (
        <div className="text-[11.5px] text-[var(--danger)]">
          Hard 会丢弃未提交改动，无法通过 GitEasy 恢复。
        </div>
      )}
    </Modal>
  )
}
