export function relativeTime(seconds: number): string {
  if (!seconds) return ''
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - seconds)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))} 个月前`
  return `${Math.floor(diff / (86400 * 365))} 年前`
}

export function formatDate(seconds: number): string {
  if (!seconds) return ''
  const d = new Date(seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export function initials(name: string): string {
  const trimmed = (name || '?').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function splitPath(path: string): { name: string; dir: string } {
  const idx = path.lastIndexOf('/')
  if (idx === -1) return { name: path, dir: '' }
  return { name: path.slice(idx + 1), dir: path.slice(0, idx) }
}

export const statusMeta: Record<
  string,
  { letter: string; label: string; className: string }
> = {
  added: { letter: 'A', label: '新增', className: 'st-added' },
  modified: { letter: 'M', label: '修改', className: 'st-modified' },
  deleted: { letter: 'D', label: '删除', className: 'st-deleted' },
  renamed: { letter: 'R', label: '重命名', className: 'st-renamed' },
  untracked: { letter: 'U', label: '未跟踪', className: 'st-untracked' },
  conflicted: { letter: '!', label: '冲突', className: 'st-conflicted' },
  typechange: { letter: 'T', label: '类型变更', className: 'st-modified' },
  copied: { letter: 'C', label: '复制', className: 'st-added' },
  unmodified: { letter: ' ', label: '无变化', className: '' }
}

export function statusOf(file: {
  staged: boolean
  index: string
  worktree: string
  conflicted: boolean
}): string {
  if (file.conflicted) return 'conflicted'
  if (file.staged) return file.index
  return file.worktree
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
