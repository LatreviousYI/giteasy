import { useApp } from '../store/app'
import { useUpdates } from '../store/updates'
import packageJson from '../../package.json'
import type { StatusDto } from '../lib/types'

const stateLabels: Record<string, string> = {
  merge: '合并中',
  rebase: '变基中',
  'cherry-pick': '拣选中',
  revert: '回滚中',
  bisect: '二分查找中',
  am: '应用补丁中'
}

export default function StatusBar({ status }: { status?: StatusDto }) {
  const repo = useApp((s) => s.repo)
  const currentVersion = useUpdates((s) => s.context?.currentVersion)
  const fileCount = status?.files.length ?? 0

  return (
    <footer className="statusbar">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: status?.clean ? 'var(--add-fg)' : 'var(--warn-fg)' }}
        />
        {repo?.branch ?? (repo?.detached ? `detached @ ${repo.headShort ?? ''}` : '—')}
      </span>
      <span className={status?.clean ? 'ok' : 'warn'}>
        {!status ? '正在读取…' : status.clean ? '工作区干净' : `${fileCount} 个变更`}
      </span>
      {status && status.state !== 'clean' && (
        <span className="warn">{stateLabels[status.state] ?? status.state}</span>
      )}
      {status && (status.ahead > 0 || status.behind > 0) && (
        <span>
          领先 {status.ahead} · 落后 {status.behind}
        </span>
      )}
      <span className="spacer" />
      <span className="hidden md:inline">{repo?.path}</span>
      <span>UTF-8</span>
      <span>GitEasy {currentVersion ?? packageJson.version}</span>
    </footer>
  )
}
