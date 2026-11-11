import { useState } from 'react'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useLog } from '../../lib/queries'
import { useApp } from '../../store/app'
import { truncate } from '../../lib/format'

export default function CommitComposer({
  busy,
  stagedCount,
  onCommitted
}: {
  busy: boolean
  stagedCount: number
  onCommitted: () => void
}) {
  const repo = useApp((s) => s.repo)!
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const { data: recentCommits } = useLog(repo.path, {
    limit: 12,
    skip: 0,
    rev: 'HEAD'
  })
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [signoff, setSignoff] = useState(false)
  const [stageAll, setStageAll] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [convType, setConvType] = useState('feat')
  const [convScope, setConvScope] = useState('')
  const [convDesc, setConvDesc] = useState('')

  const applyConventional = () => {
    const description = convDesc.trim()
    if (!description) return
    const scope = convScope.trim()
    const prefix = `${convType}${scope ? `(${scope})` : ''}: ${description}`
    const rest = message.includes('\n') ? message.slice(message.indexOf('\n')) : ''
    setMessage(prefix + rest)
  }

  const commit = async () => {
    if (!message.trim() || committing) return
    setCommitting(true)
    try {
      const result = await ipc.commitCreate(repo.path, message, amend, signoff, stageAll)
      setMessage('')
      setAmend(false)
      onCommitted()
      toast('success', '提交成功', result.output ? { detail: result.output } : undefined)
    } catch (error) {
      errorToast(error)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="composer">
      <div className="composer-top">
        <span>
          提交到 <b className="text-[var(--text)]">{repo.branch ?? 'HEAD'}</b>
        </span>
        <span>·</span>
        <span>{stagedCount} 个已暂存文件</span>
        {recentCommits && recentCommits.commits.length > 0 && (
          <select
            className="select"
            style={{ width: 170, height: 24, padding: '0 7px', fontSize: 10.5 }}
            value=""
            title="使用最近提交信息"
            onChange={(event) => {
              if (event.target.value) setMessage(event.target.value)
            }}
          >
            <option value="">最近提交信息…</option>
            {recentCommits.commits.map((commit) => (
              <option key={commit.oid} value={commit.subject}>
                {truncate(commit.subject, 56)}
              </option>
            ))}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <span className="text-[10.5px] text-[var(--text-subtle)]">Ctrl + Enter 提交</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="select"
          style={{ width: 100, flex: '0 0 100px', height: 28, padding: '0 8px' }}
          value={convType}
          onChange={(event) => setConvType(event.target.value)}
          title="Conventional Commit 类型"
        >
          {['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'].map(
            (type) => (
              <option key={type} value={type}>
                {type}
              </option>
            )
          )}
        </select>
        <input
          className="input"
          style={{ width: 130, flex: '0 0 130px', height: 28 }}
          value={convScope}
          placeholder="scope（可选）"
          onChange={(event) => setConvScope(event.target.value)}
        />
        <input
          className="input"
          style={{ flex: 1, height: 28 }}
          value={convDesc}
          placeholder="一句话描述，套用生成规范提交信息"
          onChange={(event) => setConvDesc(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              applyConventional()
            }
          }}
        />
        <button
          className="btn btn-sm"
          onClick={applyConventional}
          disabled={!convDesc.trim()}
        >
          套用
        </button>
      </div>
      <textarea
        id="commit-message"
        value={message}
        placeholder={'提交信息（第一行是标题）\n\n可选：补充详细说明'}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
      />
      <div className="composer-foot">
        <label className="check">
          <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} />
          修补上次提交
        </label>
        <label className="check">
          <input type="checkbox" checked={signoff} onChange={(e) => setSignoff(e.target.checked)} />
          Sign-off
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={stageAll}
            onChange={(e) => setStageAll(e.target.checked)}
          />
          提交前暂存全部
        </label>
        <span className="spacer" />
        <button
          className="btn btn-primary"
          disabled={!message.trim() || committing || busy || (stagedCount === 0 && !stageAll)}
          onClick={commit}
        >
          {committing ? (
            <>
              <RefreshCw size={13} className="animate-spin" /> 提交中…
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              提交
            </>
          )}
        </button>
      </div>
    </div>
  )
}
