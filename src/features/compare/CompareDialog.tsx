import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, GitCompareArrows } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useBranches, useTags } from '../../lib/queries'
import { useApp } from '../../store/app'
import { statusMeta } from '../../lib/format'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'
import DiffViewer from '../diff/DiffViewer'

export default function CompareDialog({
  onClose,
  initialLeft = 'HEAD~1',
  initialRight = 'WORKTREE'
}: {
  onClose: () => void
  initialLeft?: string
  initialRight?: string
}) {
  const repo = useApp((s) => s.repo)
  const layout = useApp((s) => s.diffLayout)
  const setLayout = useApp((s) => s.setDiffLayout)
  const ignoreWhitespace = useApp((s) => s.diffIgnoreWhitespace)
  const setIgnoreWhitespace = useApp((s) => s.setDiffIgnoreWhitespace)
  const contextLines = useApp((s) => s.diffContextLines)
  const setContextLines = useApp((s) => s.setDiffContextLines)
  const { data: branches = [] } = useBranches(repo?.path ?? null)
  const { data: tags = [] } = useTags(repo?.path ?? null)
  const [left, setLeft] = useState(initialLeft)
  const [right, setRight] = useState(initialRight)
  const [submitted, setSubmitted] = useState<{ left: string; right: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const refs = useMemo(
    () => [
      'HEAD',
      'WORKTREE',
      ...branches.map((branch) => branch.name),
      ...tags.map((tag) => tag.name)
    ],
    [branches, tags]
  )

  const compareQuery = useQuery({
    queryKey: ['compare', repo?.path, submitted?.left, submitted?.right],
    queryFn: () =>
      ipc.compareRefs(
        repo!.path,
        submitted!.left,
        submitted!.right
      ),
    enabled: !!repo && !!submitted
  })

  useEffect(() => {
    setSelectedFile(compareQuery.data?.files[0]?.path ?? null)
  }, [compareQuery.data?.leftOid, compareQuery.data?.rightOid])

  const diffQuery = useQuery({
    queryKey: [
      'diff',
      repo?.path,
      'range',
      submitted?.left,
      submitted?.right,
      selectedFile,
      ignoreWhitespace,
      contextLines
    ],
    queryFn: () =>
      ipc.diffRange(
        repo!.path,
        submitted!.left,
        submitted!.right,
        selectedFile!,
        ignoreWhitespace,
        contextLines
      ),
    enabled: !!repo && !!submitted && !!selectedFile
  })

  if (!repo) return null

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <GitCompareArrows size={15} />
          比较 Ref
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="text-[11px] text-[var(--text-subtle)]">
            {compareQuery.data
              ? `${compareQuery.data.files.length} 个文件不同`
              : '选择两个 Ref 后开始比较'}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            关闭
          </button>
          <button
            className="btn btn-primary"
            disabled={!left.trim() || !right.trim() || compareQuery.isFetching}
            onClick={() => {
              setSubmitted({ left: left.trim(), right: right.trim() })
            }}
          >
            {compareQuery.isFetching ? '比较中…' : '比较'}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <input
          className="input mono"
          list="compare-refs"
          value={left}
          onChange={(event) => setLeft(event.target.value)}
          placeholder="左侧 Ref，例如 main"
        />
        <ArrowRight size={14} className="text-subtle" />
        <input
          className="input mono"
          list="compare-refs"
          value={right}
          onChange={(event) => setRight(event.target.value)}
          placeholder="右侧 Ref，例如 WORKTREE"
        />
        <button
          className="btn btn-sm"
          onClick={() => setRight('WORKTREE')}
          title="与当前工作区比较"
        >
          工作区
        </button>
        <datalist id="compare-refs">
          {refs.map((ref) => (
            <option key={ref} value={ref} />
          ))}
        </datalist>
      </div>

      {compareQuery.data && (
        <div className="text-[10.5px] text-[var(--text-subtle)] mb-2 mono">
          {compareQuery.data.leftLabel} {compareQuery.data.leftOid.slice(0, 8)} →{' '}
          {compareQuery.data.rightLabel} {compareQuery.data.rightOid.slice(0, 8)}
        </div>
      )}

      <div className="flex" style={{ height: '56vh', margin: '0 -16px -16px' }}>
        <div
          style={{
            width: 260,
            flex: '0 0 260px',
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 8
          }}
        >
          {compareQuery.isLoading && (
            <div className="flex items-center gap-2 px-2 py-2 text-[12px] text-[var(--text-muted)]">
              <Spinner /> 正在比较…
            </div>
          )}
          {!compareQuery.isLoading && !compareQuery.data && (
            <Empty
              icon={<GitCompareArrows size={20} />}
              title="开始比较"
              subtitle="选择两个分支、Tag、提交或工作区。"
            />
          )}
          {compareQuery.data?.files.length === 0 && (
            <Empty title="没有文件差异" subtitle="两个 Ref 的内容一致。" />
          )}
          {compareQuery.data?.files.map((file) => {
            const meta = statusMeta[file.status] ?? statusMeta.modified
            return (
              <div
                key={file.path}
                className={`detail-file ${selectedFile === file.path ? 'active' : ''}`}
                onClick={() => setSelectedFile(file.path)}
                title={file.path}
              >
                <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
                <span className="path">{file.path}</span>
                <span className="add-count">+{file.additions}</span>
                <span className="del-count">-{file.deletions}</span>
              </div>
            )
          })}
        </div>
        <div className="flex-1 min-w-0">
          <DiffViewer
            diff={diffQuery.data}
            loading={diffQuery.isLoading}
            layout={layout}
            onLayoutChange={setLayout}
            ignoreWhitespace={ignoreWhitespace}
            onToggleWhitespace={setIgnoreWhitespace}
            contextLines={contextLines}
            onContextLinesChange={setContextLines}
            imageSource={{
              kind: 'range',
              left: submitted?.left ?? left,
              right: submitted?.right ?? right
            }}
          />
        </div>
      </div>
    </Modal>
  )
}
