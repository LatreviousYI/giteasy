import { useEffect, useState } from 'react'
import { GitCommitHorizontal, GitMerge } from 'lucide-react'
import { useRemoteActions } from '../../lib/remote'
import type { PullStrategy } from '../../lib/types'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'

const STRATEGIES: Array<{
  value: PullStrategy
  title: string
  description: string
  command: string
  icon: typeof GitMerge
}> = [
  {
    value: 'merge',
    title: '合并远端改动',
    description: '保留本地已有提交，并创建一个合并提交。',
    command: 'git pull --no-rebase --ff',
    icon: GitMerge
  },
  {
    value: 'rebase',
    title: '把本地提交变基到远端',
    description: '重放尚未推送的本地提交，得到线性历史。',
    command: 'git pull --rebase',
    icon: GitCommitHorizontal
  }
]

export default function PullStrategyDialog() {
  const prompt = useApp((state) => state.pullPrompt)
  const repo = useApp((state) => state.repo)
  const setPullPrompt = useApp((state) => state.setPullPrompt)
  const setRepoPullStrategy = useApp((state) => state.setRepoPullStrategy)
  const { runRemote } = useRemoteActions()
  const [strategy, setStrategy] = useState<PullStrategy>('merge')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!prompt) return
    setStrategy('merge')
    setRemember(false)
    setBusy(false)
  }, [prompt?.repoPath, prompt?.ahead, prompt?.behind])

  if (!prompt) return null

  const activeRepo = repo?.path === prompt.repoPath
  const close = () => {
    if (!busy) setPullPrompt(null)
  }
  const confirm = async () => {
    if (!activeRepo || busy) return
    setBusy(true)
    if (remember) setRepoPullStrategy(prompt.repoPath, strategy)
    setPullPrompt(null)
    await runRemote('pull', false, prompt.remoteName, strategy)
    setBusy(false)
  }

  return (
    <Modal
      title="远端分支与本地分支已分叉"
      onClose={close}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={close} disabled={busy}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void confirm()}
            disabled={busy || !activeRepo}
          >
            {busy ? '拉取中…' : '开始拉取'}
          </button>
        </>
      }
    >
      <div className="pull-divergence-summary">
        <div className="pull-divergence-stat">
          <strong>↑{prompt.ahead}</strong>
          <span>本地提交</span>
        </div>
        <div className="pull-divergence-branch mono">{prompt.branch}</div>
        <div className="pull-divergence-stat">
          <strong>↓{prompt.behind}</strong>
          <span>远端提交</span>
        </div>
      </div>

      <div className="pull-strategy-list" role="radiogroup" aria-label="Pull 策略">
        {STRATEGIES.map((option) => {
          const Icon = option.icon
          const selected = strategy === option.value
          return (
            <label
              key={option.value}
              className={`pull-strategy-option ${selected ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="pull-strategy"
                value={option.value}
                checked={selected}
                onChange={() => setStrategy(option.value)}
                disabled={busy}
              />
              <Icon size={16} className="pull-strategy-icon" />
              <span className="pull-strategy-copy">
                <strong>{option.title}</strong>
                <span>{option.description}</span>
                <code>{option.command}</code>
              </span>
            </label>
          )
        })}
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          disabled={busy}
        />
        记住此仓库的选择，下次直接使用
      </label>
    </Modal>
  )
}
