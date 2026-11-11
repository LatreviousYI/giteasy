import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitBranch, RotateCcw, SkipForward } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { Spinner } from '../../components/Empty'

export default function BisectDialog() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setBisectOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const [bad, setBad] = useState('HEAD')
  const [good, setGood] = useState('HEAD~10')
  const query = useQuery({
    queryKey: ['bisectStatus', repo?.path],
    queryFn: () => ipc.bisectStatus(repo!.path),
    enabled: !!repo
  })

  if (!repo) return null

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      await query.refetch()
      invalidate()
      toast('success', message)
    } catch (error) {
      errorToast(error)
    }
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <GitBranch size={15} />
          Git Bisect
        </span>
      }
      onClose={close}
      footer={
        <>
          <button
            className="btn"
            onClick={() => run(() => ipc.bisectReset(repo.path), 'Bisect 已重置')}
          >
            <RotateCcw size={13} />
            重置
          </button>
          <span className="spacer" />
          <button
            className="btn"
            onClick={() => run(() => ipc.bisectSkip(repo.path), '已跳过当前提交')}
          >
            <SkipForward size={13} />
            Skip
          </button>
          <button
            className="btn"
            onClick={() => run(() => ipc.bisectMark(repo.path, 'good'), '已标记 Good')}
          >
            Good
          </button>
          <button
            className="btn btn-danger"
            onClick={() => run(() => ipc.bisectMark(repo.path, 'bad'), '已标记 Bad')}
          >
            Bad
          </button>
        </>
      }
    >
      {query.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="detail-block">
              <b>状态</b>
              <div className="mt-1">{query.data?.active ? '进行中' : '未开始'}</div>
            </div>
            <div className="detail-block">
              <b>当前提交</b>
              <div className="mono mt-1">{query.data?.shortOid ?? '-'}</div>
            </div>
            <div className="detail-block">
              <b>操作</b>
              <div className="mt-1">good / bad / skip</div>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              开始 Bisect
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <input
                className="input mono"
                value={bad}
                onChange={(event) => setBad(event.target.value)}
                placeholder="Bad Ref"
              />
              <input
                className="input mono"
                value={good}
                onChange={(event) => setGood(event.target.value)}
                placeholder="Good Ref"
              />
              <button
                className="btn"
                disabled={!bad.trim() || !good.trim()}
                onClick={() =>
                  run(
                    () => ipc.bisectStart(repo.path, bad.trim(), good.trim()),
                    'Bisect 已开始'
                  )
                }
              >
                开始
              </button>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Bisect Log
            </div>
            <pre className="conflict-code" style={{ maxHeight: 240 }}>
              {query.data?.log || '暂无 Bisect 日志'}
            </pre>
          </div>
        </>
      )}
    </Modal>
  )
}
