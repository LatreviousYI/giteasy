import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, ChevronDown, ChevronRight, Copy, XCircle } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import type { ActivityEvent } from '../../lib/types'

function formatTime(value: number) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export default function ActivityPanel() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setActivityOpen(false)
  const toast = useApp((s) => s.toast)
  const [expanded, setExpanded] = useState<number | null>(null)
  const query = useQuery({
    queryKey: ['activity', repo?.path],
    queryFn: () => ipc.activityList(repo!.path, 100),
    enabled: !!repo,
    refetchInterval: 3000
  })

  if (!repo) return null
  const events = query.data ?? []

  const copyEvent = async (event: ActivityEvent) => {
    const text = [
      `$ ${event.command}`,
      event.summary,
      event.output ?? '',
      event.error ?? ''
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('success', '操作记录已复制')
    } catch {
      toast('warn', '无法访问剪贴板')
    }
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <Activity size={15} />
          操作记录
          <span className="text-[11px] font-normal text-[var(--text-subtle)]">
            {repo.name}
          </span>
        </span>
      }
      onClose={close}
    >
      <div style={{ maxHeight: '62vh', overflow: 'auto', margin: -16 }}>
        {query.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : events.length === 0 ? (
          <Empty
            icon={<Activity size={20} />}
            title="暂无操作记录"
            subtitle="Git 命令、hooks 输出和错误会显示在这里。"
          />
        ) : (
          <div className="p-2">
            {events.map((event) => {
              const open = expanded === event.id
              return (
                <div
                  key={event.id}
                  className="list-row"
                  style={{ alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => setExpanded(open ? null : event.id)}
                >
                  <span style={{ paddingTop: 3 }}>
                    {event.status === 'error' ? (
                      <XCircle size={13} className="del-text" />
                    ) : (
                      <CheckCircle2 size={13} className="add-text" />
                    )}
                  </span>
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="mono text-[11px] truncate" title={event.command}>
                        {event.command}
                      </span>
                      <span className="spacer" />
                      <span className="row-sub">{event.durationMs}ms</span>
                      <span className="row-sub">{formatTime(event.finishedAt)}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {event.summary}
                    </div>
                    {open && (
                      <div className="mt-2">
                        <div className="flex justify-end mb-1">
                          <button
                            className="btn btn-sm"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              void copyEvent(event)
                            }}
                          >
                            <Copy size={12} />
                            复制
                          </button>
                        </div>
                        <pre className="conflict-code" style={{ maxHeight: 220 }}>
                          {event.output || event.error || event.summary}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
