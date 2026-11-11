import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  GitMerge
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useConflicts, useInvalidateRepo, useStatus } from '../../lib/queries'
import { useApp } from '../../store/app'
import { Empty, Spinner } from '../../components/Empty'
import {
  parseConflictBlocks,
  resolveAllConflictBlocks,
  resolveConflictBlock,
  type ConflictChoice
} from '../../lib/conflict'

export default function ConflictsView() {
  const repo = useApp((s) => s.repo)!
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo.path)
  const { data: conflicts = [], isLoading } = useConflicts(repo.path)
  const { data: status } = useStatus(repo.path)

  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [showBase, setShowBase] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (conflicts.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !conflicts.some((item) => item.path === selected)) {
      setSelected(conflicts[0].path)
    }
  }, [conflicts, selected])

  useEffect(() => {
    const file = conflicts.find((item) => item.path === selected)
    if (file) setContent(file.result)
    // 仅在切换文件或冲突列表首次加载时重置编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, conflicts.length])

  const current = useMemo(
    () => conflicts.find((item) => item.path === selected) ?? null,
    [conflicts, selected]
  )

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
    }
  }

  const resolve = async () => {
    if (!current) return
    await run(() => ipc.conflictResolve(repo.path, current.path, content), '已标记为已解决')
  }

  const continueOperation = async () => {
    if (!status || status.state === 'clean') return
    await run(() => ipc.opContinue(repo.path, status.state), '操作已继续')
  }

  const abortOperation = async () => {
    if (!status || status.state === 'clean') return
    await run(() => ipc.opAbort(repo.path, status.state), '已中止操作')
  }

  const useOurs = () => current?.ours !== null && setContent(current?.ours ?? '')
  const useTheirs = () => current?.theirs !== null && setContent(current?.theirs ?? '')
  const useBoth = () => setContent(`${current?.ours ?? ''}${current?.theirs ?? ''}`)
  const openExternal = async () => {
    if (!current) return
    try {
      await ipc.openInEditor(repo.path, current.path)
    } catch (error) {
      errorToast(error)
    }
  }

  const blocks = useMemo(() => parseConflictBlocks(content), [content])

  const adoptBlock = (index: number, choice: ConflictChoice) => {
    setContent((prev) => resolveConflictBlock(prev, index, choice))
  }

  const adoptAll = (choice: ConflictChoice) => {
    setContent((prev) => resolveAllConflictBlocks(prev, choice).text)
  }

  return (
    <div className="content">
      <section className="file-panel" style={{ width: 268, flex: '0 0 268px' }}>
        <div className="panel-head">
          <FileWarning size={13} />
          冲突文件
          <span className="spacer" />
          <span className="row-sub">{conflicts.length}</span>
        </div>
        <div className="scroll-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="empty" style={{ paddingTop: 50 }}>
              <div className="empty-icon">
                <CheckCircle2 size={22} className="add-text" />
              </div>
              <div className="empty-title">没有冲突</div>
              <div className="empty-sub">当前仓库没有待解决的冲突文件。</div>
            </div>
          ) : (
            conflicts.map((file) => (
              <div
                key={file.path}
                className={`file-row ${selected === file.path ? 'active' : ''}`}
                onClick={() => setSelected(file.path)}
              >
                <span className="file-letter st-conflicted">!</span>
                <div className="file-row-main">
                  <div className="file-label">
                    <span className="file-name">{file.path}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="conflict-pane">
        {status && status.state !== 'clean' && (
          <div className="conflict-banner">
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>
              正在 <b>{status.state}</b>。解决全部冲突并标记后，可继续完成操作。
            </span>
            <button className="btn btn-sm" onClick={continueOperation} disabled={busy}>
              继续
            </button>
            <button className="btn btn-sm btn-danger" onClick={abortOperation} disabled={busy}>
              中止
            </button>
          </div>
        )}

        {!current ? (
          <Empty
            icon={<GitMerge size={20} />}
            title={status?.state && status.state !== 'clean' ? '等待冲突文件' : '没有进行中的合并'}
            subtitle={
              status?.state && status.state !== 'clean'
                ? '所有冲突都已解决，可以继续操作。'
                : '当合并、变基或拣选产生冲突时，这里会列出需要处理的文件。'
            }
          />
        ) : (
          <div className="conflict-body">
            <div className="conflict-versions">
              <div className="conflict-side">
                <div className="conflict-col-head">
                  我的版本（ours）
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-sm" onClick={useOurs} disabled={!current.ours}>
                    采用
                  </button>
                </div>
                <pre className="conflict-code">
                  {current.ours ?? '（该文件没有 ours 版本）'}
                </pre>
              </div>

              {showBase && (
                <div className="conflict-side">
                  <div className="conflict-col-head">共同祖先（base）</div>
                  <pre className="conflict-code">
                    {current.base ?? '（该文件没有 base 版本）'}
                  </pre>
                </div>
              )}

              <div className="conflict-side conflict-side-last">
                <div className="conflict-col-head">
                  对方版本（theirs）
                  <span style={{ flex: 1 }} />
                  <button
                    className="btn btn-sm"
                    onClick={useTheirs}
                    disabled={!current.theirs}
                  >
                    采用
                  </button>
                </div>
                <pre className="conflict-code">
                  {current.theirs ?? '（该文件没有 theirs 版本）'}
                </pre>
              </div>
            </div>

            <div className="conflict-result">
              <div className="conflict-col-head">
                合并结果（可编辑）
                <span style={{ flex: 1 }} />
                <button
                  className={`btn btn-sm ${showBase ? 'btn-primary' : ''}`}
                  onClick={() => setShowBase((value) => !value)}
                  title="显示/隐藏共同祖先版本"
                  disabled={busy}
                >
                  base 对照
                </button>
                <button className="btn btn-sm" onClick={openExternal} disabled={busy}>
                  <ExternalLink size={12} />
                  外部工具
                </button>
                <button className="btn btn-sm" onClick={useBoth} disabled={busy}>
                  两者保留
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={resolve}
                  disabled={busy}
                  title="写入文件并暂存"
                >
                  标记已解决
                </button>
              </div>
              {current.binary ? (
                <div className="binary-note">二进制冲突，请使用外部工具处理后标记为已解决。</div>
              ) : (
                <>
                  {blocks.length > 0 && (
                    <div className="conflict-blocks">
                      <div className="flex items-center gap-2">
                        <span>
                          冲突块 <b>{blocks.length}</b>
                        </span>
                        <span style={{ flex: 1 }} />
                        <button
                          className="btn btn-sm"
                          onClick={() => adoptAll('ours')}
                          disabled={busy}
                        >
                          全部采用我的
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => adoptAll('theirs')}
                          disabled={busy}
                        >
                          全部采用对方
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => adoptAll('both')}
                          disabled={busy}
                        >
                          全部保留两者
                        </button>
                      </div>
                      {blocks.map((block) => (
                        <div className="conflict-block" key={block.index}>
                          <div className="conflict-block-head">
                            <span>第 {block.index + 1} 块</span>
                            <span style={{ flex: 1 }} />
                            <button
                              className="btn btn-sm"
                              onClick={() => adoptBlock(block.index, 'ours')}
                              disabled={busy}
                            >
                              采用我的
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => adoptBlock(block.index, 'theirs')}
                              disabled={busy}
                            >
                              采用对方
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => adoptBlock(block.index, 'both')}
                              disabled={busy}
                            >
                              两者保留
                            </button>
                          </div>
                          <div className="conflict-block-preview">
                            <pre className="conflict-block-side add-text">{block.ours || '（空）'}</pre>
                            <pre className="conflict-block-side del-text">
                              {block.theirs || '（空）'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    className="conflict-editor"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    spellCheck={false}
                  />
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
