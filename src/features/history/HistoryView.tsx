import { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  GitCommitHorizontal,
  RefreshCw,
  Search,
  UserRound
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo, useLog } from '../../lib/queries'
import { useApp } from '../../store/app'
import { buildGraph, type GraphRow } from '../../lib/graph'
import { relativeTime } from '../../lib/format'
import type { LogQuery } from '../../lib/types'
import { Empty, Spinner } from '../../components/Empty'
import { ConfirmDialog } from '../../components/Dialogs'
import RebaseDialog from '../rebase/RebaseDialog'
import { CommitDetailPane, GraphCell } from './HistoryDetails'

export default function HistoryView() {
  const repo = useApp((s) => s.repo)!
  const selectedCommit = useApp((s) => s.selectedCommit)
  const selectCommit = useApp((s) => s.selectCommit)
  const layout = useApp((s) => s.diffLayout)
  const setDiffLayout = useApp((s) => s.setDiffLayout)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo.path)

  const [search, setSearch] = useState('')
  const [author, setAuthor] = useState('')
  const [pathFilter, setPathFilter] = useState('')
  const [debounced, setDebounced] = useState('')
  const [authorDebounced, setAuthorDebounced] = useState('')
  const [pathDebounced, setPathDebounced] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [limit, setLimit] = useState(300)
  const [resetMenu, setResetMenu] = useState(false)
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard' | null>(null)
  const [rebaseOpen, setRebaseOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setAuthorDebounced(author.trim())
      setPathDebounced(pathFilter.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [search, author, pathFilter])

  const query: LogQuery = useMemo(
    () => ({
      limit,
      skip: 0,
      rev: 'HEAD',
      query: debounced || null,
      author: authorDebounced || null,
      file: pathDebounced || null
    }),
    [limit, debounced, authorDebounced, pathDebounced]
  )

  const { data, isLoading, isFetching, refetch } = useLog(repo.path, query)
  const commits = data?.commits ?? []
  const graph = useMemo(() => buildGraph(commits), [commits])
  const rowByOid = useMemo(() => {
    const map = new Map<string, GraphRow>()
    for (const row of graph.rows) map.set(row.oid, row)
    return map
  }, [graph])

  useEffect(() => {
    if (commits.length === 0) {
      if (selectedCommit) selectCommit(null)
      return
    }
    if (!selectedCommit || !commits.some((commit) => commit.oid === selectedCommit)) {
      selectCommit(commits[0].oid)
    }
  }, [commits, selectedCommit, selectCommit])

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      invalidate()
      toast('success', message)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
      setResetMode(null)
      setResetMenu(false)
    }
  }

  const copyOid = async (oid: string) => {
    try {
      await navigator.clipboard.writeText(oid)
      toast('success', '已复制提交哈希')
    } catch {
      toast('warn', '无法访问剪贴板')
    }
  }

  return (
    <div className="content">
      <section className="commit-list">
        <div className="panel-head">
          <GitCommitHorizontal size={13} />
          提交历史
          <span className="spacer" />
          {isFetching && <Spinner />}
          <button className="icon-btn" title="刷新" onClick={() => refetch()}>
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="commit-filters">
          <div className="search-box">
            <Search size={13} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索提交信息…"
            />
          </div>
        </div>
        <div className="commit-filters" style={{ paddingTop: 0 }}>
          <div className="search-box">
            <UserRound size={13} />
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="按作者过滤…"
            />
          </div>
          <div className="search-box">
            <FileText size={13} />
            <input
              value={pathFilter}
              onChange={(event) => setPathFilter(event.target.value)}
              placeholder="按路径过滤，如 src/"
            />
          </div>
        </div>

        <div className="scroll-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : commits.length === 0 ? (
            <Empty
              icon={<GitCommitHorizontal size={20} />}
              title={selectedCommit === null && debounced ? '没有匹配的提交' : '暂无提交'}
              subtitle={debounced ? '试试其他关键词。' : '这个仓库还没有提交记录。'}
            />
          ) : (
            <>
              {commits.map((commit) => {
                const row = rowByOid.get(commit.oid)
                return (
                  <div
                    key={commit.oid}
                    className={`commit-row ${selectedCommit === commit.oid ? 'active' : ''}`}
                    onClick={() => selectCommit(commit.oid)}
                  >
                    <div className="graph-cell">{row && <GraphCell row={row} />}</div>
                    <div className="commit-main">
                      <div className="commit-subject">
                        {commit.refs.slice(0, 3).map((ref) => (
                          <span
                            key={`${ref.kind}-${ref.name}`}
                            className={`ref-chip ref-${ref.kind}`}
                            title={ref.name}
                          >
                            {ref.name}
                          </span>
                        ))}
                        <span className="commit-subject-text">{commit.subject || '(无提交信息)'}</span>
                      </div>
                      <div className="commit-meta">
                        <span>{commit.authorName}</span>
                        <span>{relativeTime(commit.time)}</span>
                        <span className="mono">{commit.shortOid}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {data?.hasMore && (
                <div className="p-2">
                  <button
                    className="btn btn-sm w-full"
                    onClick={() => setLimit((value) => value + 300)}
                  >
                    加载更多
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="detail">
        {!selectedCommit ? (
          <Empty
            icon={<GitCommitHorizontal size={20} />}
            title="选择一个提交"
            subtitle="点击左侧任意提交查看详情与改动。"
          />
        ) : (
          <CommitDetailPane
            repoPath={repo.path}
            oid={selectedCommit}
            layout={layout}
            onLayoutChange={setDiffLayout}
            busy={busy}
            ignoreWhitespace={ignoreWhitespace}
            onToggleWhitespace={setIgnoreWhitespace}
            onCheckout={() =>
              run(() => ipc.commitCheckout(repo.path, selectedCommit), '已检出该提交（分离头指针）')
            }
            onCherryPick={() =>
              run(() => ipc.cherryPick(repo.path, selectedCommit), '已拣选该提交')
            }
            onRevert={() => run(() => ipc.revert(repo.path, selectedCommit), '已回滚该提交')}
            onRebase={() => setRebaseOpen(true)}
            onCopy={() => copyOid(selectedCommit)}
            onReset={(mode) => setResetMode(mode)}
            resetMenuOpen={resetMenu}
            setResetMenuOpen={setResetMenu}
          />
        )}
      </section>

      <ConfirmDialog
        open={!!resetMode}
        title={`重置到提交（${resetMode ?? ''}）`}
        danger={resetMode === 'hard'}
        confirmLabel="执行重置"
        busy={busy}
        message={
          <div>
            <p style={{ marginTop: 0 }}>
              将当前分支重置到 <span className="mono">{selectedCommit?.slice(0, 8)}</span>。
            </p>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-muted)' }}>
              <li>soft：保留暂存区与工作区改动</li>
              <li>mixed：保留工作区改动，清空暂存区</li>
              <li>hard：丢弃暂存区与工作区改动（危险）</li>
            </ul>
          </div>
        }
        onCancel={() => setResetMode(null)}
        onConfirm={() =>
          resetMode &&
          run(() => ipc.reset(repo.path, selectedCommit!, resetMode), `已重置（${resetMode}）`)
        }
      />

      {rebaseOpen && selectedCommit && (
        <RebaseDialog
          base={selectedCommit}
          baseSubject={
            commits.find((commit) => commit.oid === selectedCommit)?.subject ?? undefined
          }
          onClose={() => setRebaseOpen(false)}
        />
      )}
    </div>
  )
}
