import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Archive,
  FileText,
  GitCompareArrows,
  GitCommitHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Undo2,
  UserRound
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { copyTextWithToast } from '../../lib/clipboard'
import { useBranches, useInvalidateRepo, useLog, useStashes, useStatus } from '../../lib/queries'
import { useApp } from '../../store/app'
import { buildGraph, type GraphRow } from '../../lib/graph'
import { relativeTime } from '../../lib/format'
import type { LogQuery, StashDto } from '../../lib/types'
import { Empty, Spinner } from '../../components/Empty'
import { ConfirmDialog } from '../../components/Dialogs'
import RebaseDialog from '../rebase/RebaseDialog'
import { CommitDetailPane, GraphCell } from './HistoryDetails'
import CompareDialog from '../compare/CompareDialog'
import ReflogDialog from '../reflog/ReflogDialog'
import StashModal from '../stashes/StashModal'
import CommitSelectionDialog from '../branches/CommitSelectionDialog'
import { useHistoryCommitActions } from './useHistoryCommitActions'

export default function HistoryView() {
  const repo = useApp((s) => s.repo)!
  const selectedCommit = useApp((s) => s.selectedCommit)
  const selectCommit = useApp((s) => s.selectCommit)
  const setRepo = useApp((s) => s.setRepo)
  const setView = useApp((s) => s.setView)
  const ignoreWhitespace = useApp((s) => s.diffIgnoreWhitespace)
  const setIgnoreWhitespace = useApp((s) => s.setDiffIgnoreWhitespace)
  const contextLines = useApp((s) => s.diffContextLines)
  const setContextLines = useApp((s) => s.setDiffContextLines)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo.path)

  const [search, setSearch] = useState('')
  const [author, setAuthor] = useState('')
  const [pathFilter, setPathFilter] = useState('')
  const [debounced, setDebounced] = useState('')
  const [authorDebounced, setAuthorDebounced] = useState('')
  const [pathDebounced, setPathDebounced] = useState('')
  const [limit, setLimit] = useState(300)
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard' | null>(null)
  const [rebaseOpen, setRebaseOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareLeft, setCompareLeft] = useState('HEAD~1')
  const [reflogOpen, setReflogOpen] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [stashPreview, setStashPreview] = useState<StashDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const commitListRef = useRef<HTMLDivElement>(null)
  const commitActions = useHistoryCommitActions()

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
      rev: '--all',
      query: debounced || null,
      author: authorDebounced || null,
      file: pathDebounced || null
    }),
    [limit, debounced, authorDebounced, pathDebounced]
  )

  const { data, isLoading, isFetching, refetch } = useLog(repo.path, query)
  const { data: status } = useStatus(repo.path)
  const { data: branches = [] } = useBranches(repo.path)
  const { data: stashes = [] } = useStashes(repo.path)
  const commits = useMemo(() => data?.commits ?? [], [data?.commits])
  const graph = useMemo(() => buildGraph(commits, branches), [commits, branches])
  const rowByOid = useMemo(() => {
    const map = new Map<string, GraphRow>()
    for (const row of graph.rows) map.set(row.oid, row)
    return map
  }, [graph])
  const listEntries = useMemo(
    () => [
      ...(!debounced && !authorDebounced && !pathDebounced
        ? stashes.map((stash) => ({ kind: 'stash' as const, stash }))
        : []),
      ...commits.map((commit) => ({ kind: 'commit' as const, commit }))
    ],
    [stashes, commits, debounced, authorDebounced, pathDebounced]
  )
  const virtualizer = useVirtualizer({
    count: listEntries.length,
    getScrollElement: () => commitListRef.current,
    estimateSize: () => 40,
    overscan: 12
  })

  useEffect(() => {
    if (commits.length === 0) {
      if (selectedCommit) selectCommit(null)
      return
    }
    if (!selectedCommit) {
      selectCommit(commits[0].oid)
      return
    }
    if (commits.some((commit) => commit.oid === selectedCommit)) return
    if (data?.hasMore) {
      if (!isFetching) setLimit((value) => value + 300)
      return
    }
    if (!isFetching) selectCommit(commits[0].oid)
  }, [commits, selectedCommit, selectCommit, data?.hasMore, isFetching])

  useEffect(() => {
    const index = listEntries.findIndex(
      (entry) => entry.kind === 'commit' && entry.commit.oid === selectedCommit
    )
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
  }, [selectedCommit, listEntries, virtualizer])

  const focusEntry = (index: number) => {
    const entry = listEntries[index]
    if (!entry) return
    if (entry.kind === 'stash') setStashPreview(entry.stash)
    else selectCommit(entry.commit.oid)
    virtualizer.scrollToIndex(index, { align: 'auto' })
    window.requestAnimationFrame(() => {
      commitListRef.current?.querySelector<HTMLElement>(`[data-list-index="${index}"]`)?.focus()
    })
  }

  const run = async (
    action: () => Promise<unknown>,
    message: string
  ): Promise<'success' | 'conflict' | 'error'> => {
    setBusy(true)
    try {
      await action()
      invalidate()
      toast('success', message)
      return 'success'
    } catch (error) {
      if ((error as { kind?: string })?.kind === 'conflict') {
        invalidate()
        setView('conflicts')
        toast('warn', '操作产生冲突', {
          message: '请在冲突页解决并标记全部文件后继续操作。'
        })
        return 'conflict'
      }
      errorToast(error)
      return 'error'
    } finally {
      setBusy(false)
    }
  }

  const copyOid = async (oid: string) => {
    await copyTextWithToast(oid, '已复制提交哈希', toast)
  }

  return (
    <div className={`content ${focusMode ? 'history-focus' : ''}`}>
      <section className="commit-list">
        <div className="panel-head">
          <GitCommitHorizontal size={13} />
          提交历史
          <span className="spacer" />
          {isFetching && <Spinner />}
          <button
            className="icon-btn"
            title={
              !status?.branch
                ? '请先检出本地分支'
                : status.state !== 'clean'
                  ? `仓库正在 ${status.state}，请先完成或中止当前操作`
                  : '选择提交创建反向提交'
            }
            aria-label="Revert 提交"
            disabled={!status?.branch || status.state !== 'clean' || busy}
            onClick={() => setRevertOpen(true)}
          >
            <Undo2 size={13} />
          </button>
          <button
            className="icon-btn"
            title="比较 Ref"
            onClick={() => {
              setCompareLeft(selectedCommit ?? 'HEAD~1')
              setCompareOpen(true)
            }}
          >
            <GitCompareArrows size={13} />
          </button>
          <button className="icon-btn" title="Reflog" onClick={() => setReflogOpen(true)}>
            <RotateCcw size={13} />
          </button>
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

        <div className="scroll-y" ref={commitListRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : listEntries.length === 0 ? (
            <Empty
              icon={<GitCommitHorizontal size={20} />}
              title={selectedCommit === null && debounced ? '没有匹配的提交' : '暂无提交'}
              subtitle={debounced ? '试试其他关键词。' : '这个仓库还没有提交记录。'}
            />
          ) : (
            <>
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: 'relative'
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const entry = listEntries[virtualRow.index]
                  if (entry.kind === 'stash') {
                    const stash = entry.stash
                    return (
                      <div
                        key={`stash-${stash.oid}`}
                        data-list-index={virtualRow.index}
                        tabIndex={0}
                        className="commit-row stash-row"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`
                        }}
                        onClick={() => setStashPreview(stash)}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            focusEntry(Math.min(listEntries.length - 1, virtualRow.index + 1))
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            focusEntry(Math.max(0, virtualRow.index - 1))
                          } else if (event.key === 'Enter') {
                            setStashPreview(stash)
                          }
                        }}
                      >
                        <div className="graph-cell">
                          <Archive size={14} className="text-[var(--warn-fg)]" />
                        </div>
                        <div className="commit-main">
                          <div className="commit-subject">
                            <span className="ref-chip ref-tag">stash@{stash.index}</span>
                            <span className="commit-subject-text">{stash.message}</span>
                          </div>
                          <div className="commit-meta">
                            <span>Stash</span>
                            <span>{relativeTime(stash.time)}</span>
                            <span className="mono">{stash.shortOid}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const commit = entry.commit
                  const row = rowByOid.get(commit.oid)
                  return (
                    <div
                      key={commit.oid}
                      data-list-index={virtualRow.index}
                      tabIndex={0}
                      className={`commit-row ${selectedCommit === commit.oid ? 'active' : ''}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                      onClick={() => selectCommit(commit.oid)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        commitActions.openMenu(commit, event.clientX, event.clientY)
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'ContextMenu' ||
                          (event.shiftKey && event.key === 'F10')
                        ) {
                          event.preventDefault()
                          const rect = event.currentTarget.getBoundingClientRect()
                          commitActions.openMenu(commit, rect.left + 32, rect.top + 24)
                        } else if (event.key === 'ArrowDown') {
                          event.preventDefault()
                          focusEntry(Math.min(listEntries.length - 1, virtualRow.index + 1))
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault()
                          focusEntry(Math.max(0, virtualRow.index - 1))
                        }
                      }}
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
                          <span className="commit-subject-text">
                            {commit.subject || '(无提交信息)'}
                          </span>
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
              </div>
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
            currentBranch={status?.branch ?? repo.branch}
            operationState={status?.state ?? repo.state}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((value) => !value)}
            busy={busy}
            ignoreWhitespace={ignoreWhitespace}
            onToggleWhitespace={setIgnoreWhitespace}
            contextLines={contextLines}
            onContextLinesChange={setContextLines}
            onCheckout={() =>
              run(async () => {
                const info = await ipc.commitCheckout(repo.path, selectedCommit)
                setRepo(info)
              }, '已检出该提交（分离头指针）')
            }
            onCherryPick={() =>
              run(async () => {
                const info = await ipc.cherryPick(repo.path, [selectedCommit])
                setRepo(info)
              }, '已拣选该提交')
            }
            onRevert={() =>
              run(async () => {
                const info = await ipc.revert(repo.path, [selectedCommit])
                setRepo(info)
              }, '已回滚该提交')
            }
            onRebase={() => setRebaseOpen(true)}
            onCopy={() => copyOid(selectedCommit)}
            onReset={(mode) => setResetMode(mode)}
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
        onConfirm={() => {
          if (!resetMode) return
          void run(async () => {
            const info = await ipc.reset(repo.path, selectedCommit!, resetMode)
            setRepo(info)
          }, `已重置（${resetMode}）`).then((result) => {
            if (result !== 'error') setResetMode(null)
          })
        }}
      />

      {revertOpen && status?.branch && (
        <CommitSelectionDialog
          repoPath={repo.path}
          mode="revert"
          sourceRef="HEAD"
          sourceLabel={status.branch}
          currentBranch={status.branch}
          busy={busy}
          onCancel={() => setRevertOpen(false)}
          onSubmit={(oids) => {
            void run(async () => {
              const info = await ipc.revert(repo.path, oids)
              setRepo(info)
            }, `已回滚 ${oids.length} 个提交`).then((result) => {
              if (result !== 'error') setRevertOpen(false)
            })
          }}
        />
      )}
      {commitActions.overlays}

      {rebaseOpen && selectedCommit && (
        <RebaseDialog
          base={selectedCommit}
          baseSubject={
            commits.find((commit) => commit.oid === selectedCommit)?.subject ?? undefined
          }
          onClose={() => setRebaseOpen(false)}
        />
      )}
      {compareOpen && (
        <CompareDialog
          initialLeft={compareLeft}
          initialRight="WORKTREE"
          onClose={() => setCompareOpen(false)}
        />
      )}
      {reflogOpen && (
        <ReflogDialog
          onClose={() => setReflogOpen(false)}
          onCompare={(oid) => {
            setCompareLeft(oid)
            setReflogOpen(false)
            setCompareOpen(true)
          }}
        />
      )}
      {stashPreview && (
        <StashModal
          repoPath={repo.path}
          stash={stashPreview}
          onClose={() => setStashPreview(null)}
          onChanged={() => {
            invalidate()
            setStashPreview(null)
          }}
        />
      )}
    </div>
  )
}
