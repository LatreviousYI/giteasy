import { useQuery } from '@tanstack/react-query'
import { Clock, GitCommitHorizontal, UserRound } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import { formatDate, relativeTime } from '../../lib/format'

export default function FileInspector() {
  const repo = useApp((s) => s.repo)
  const inspector = useApp((s) => s.inspector)
  const close = useApp((s) => s.closeInspector)
  const selectCommit = useApp((s) => s.selectCommit)
  const setView = useApp((s) => s.setView)

  const historyQuery = useQuery({
    queryKey: [
      'fileHistory',
      repo?.path,
      inspector?.file,
      inspector?.lineStart,
      inspector?.lineEnd
    ],
    queryFn: () =>
      inspector?.lineStart && inspector.lineEnd
        ? ipc.lineHistory(
            repo!.path,
            inspector!.file,
            inspector.lineStart,
            inspector.lineEnd,
            200
          )
        : ipc.fileHistory(repo!.path, inspector!.file, 200),
    enabled: !!repo && !!inspector && inspector.mode === 'history'
  })

  const blameQuery = useQuery({
    queryKey: ['blame', repo?.path, inspector?.file],
    queryFn: () => ipc.blameGet(repo!.path, inspector!.file),
    enabled: !!repo && !!inspector && inspector.mode === 'blame'
  })

  if (!repo || !inspector) return null

  const isHistory = inspector.mode === 'history'
  const loading = isHistory ? historyQuery.isLoading : blameQuery.isLoading
  const history = historyQuery.data?.commits ?? []
  const blame = blameQuery.data ?? []

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2 min-w-0">
          {isHistory ? <Clock size={15} /> : <UserRound size={15} />}
          <span className="mono text-[12px] truncate">{inspector.file}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">
            {isHistory
              ? inspector.lineStart
                ? `代码行历史 ${inspector.lineStart}-${inspector.lineEnd}`
                : '文件历史'
              : 'Blame'}
          </span>
        </span>
      }
      onClose={close}
    >
      <div style={{ maxHeight: '62vh', overflow: 'auto', margin: -16 }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : isHistory ? (
          history.length === 0 ? (
            <Empty
              icon={<GitCommitHorizontal size={20} />}
              title="暂无文件历史"
              subtitle="该文件可能尚未被提交。"
            />
          ) : (
            <div className="p-2">
              {history.map((commit) => (
                <div
                  key={commit.oid}
                  className="list-row"
                  title={commit.subject}
                  onClick={() => {
                    selectCommit(commit.oid)
                    setView('history')
                    close()
                  }}
                >
                  <GitCommitHorizontal size={13} className="text-subtle" />
                  <span className="truncate" style={{ flex: 1 }}>
                    {commit.subject}
                  </span>
                  <span className="row-sub">{commit.authorName}</span>
                  <span className="row-sub" title={formatDate(commit.time)}>
                    {relativeTime(commit.time)}
                  </span>
                  <span className="mono text-[11px] text-[var(--text-subtle)]">
                    {commit.shortOid}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : blame.length === 0 ? (
          <Empty
            icon={<UserRound size={20} />}
            title="暂无 Blame 数据"
            subtitle="该文件可能尚未被提交，或不在当前工作区。"
          />
        ) : (
          <div className="font-mono" style={{ fontSize: 11.5 }}>
            {blame.map((line) => (
              <div
                key={line.lineNo}
                className="flex items-start"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span
                  className="text-right text-[var(--text-subtle)]"
                  style={{ width: 48, flex: '0 0 48px', padding: '3px 8px' }}
                >
                  {line.lineNo}
                </span>
                <span
                  className="truncate text-[var(--text-muted)]"
                  style={{ width: 120, flex: '0 0 120px', padding: '3px 8px' }}
                  title={line.author}
                >
                  {line.author || '-'}
                </span>
                <span
                  className="text-[var(--text-subtle)]"
                  style={{ width: 72, flex: '0 0 72px', padding: '3px 8px' }}
                  title={line.oid}
                >
                  {line.shortOid}
                </span>
                <span
                  className="whitespace-pre-wrap text-[var(--text-secondary)]"
                  style={{ flex: 1, padding: '3px 8px', wordBreak: 'break-word' }}
                >
                  {line.content || ' '}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
