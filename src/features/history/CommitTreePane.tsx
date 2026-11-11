import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { Spinner } from '../../components/Empty'
import type { TreeEntryDto } from '../../lib/types'

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function hasCollapsedParent(path: string, collapsed: Record<string, boolean>) {
  const parts = path.split('/')
  for (let index = 1; index < parts.length; index += 1) {
    const parent = parts.slice(0, index).join('/')
    if (collapsed[parent]) return true
  }
  return false
}

export default function CommitTreePane({
  repoPath,
  rev
}: {
  repoPath: string
  rev: string
}) {
  const treeQuery = useQuery({
    queryKey: ['commitTree', repoPath, rev],
    queryFn: () => ipc.commitTree(repoPath, rev)
  })
  const entries = treeQuery.data ?? []
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const firstFile = useMemo(
    () => entries.find((entry) => entry.kind === 'blob')?.path ?? null,
    [entries]
  )

  useEffect(() => {
    setCollapsed({})
    setSelected(firstFile)
  }, [rev, firstFile])

  const contentQuery = useQuery({
    queryKey: ['fileAtRev', repoPath, rev, selected],
    queryFn: () => ipc.fileAtRev(repoPath, rev, selected!),
    enabled: !!selected
  })

  const visibleEntries = entries.filter(
    (entry) => !hasCollapsedParent(entry.path, collapsed)
  )

  const toggle = (entry: TreeEntryDto) => {
    if (entry.kind !== 'tree') return
    setCollapsed((current) => ({
      ...current,
      [entry.path]: !current[entry.path]
    }))
  }

  if (treeQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="commit-tree-pane">
      <div className="commit-tree-list">
        {visibleEntries.map((entry) => {
          const depth = entry.path.split('/').length - 1
          const isTree = entry.kind === 'tree'
          const isCollapsed = !!collapsed[entry.path]
          return (
            <div
              key={entry.path}
              className={`list-row ${selected === entry.path ? 'active' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                if (isTree) toggle(entry)
                else setSelected(entry.path)
              }}
              title={entry.path}
            >
              {isTree ? (
                isCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )
              ) : (
                <span style={{ width: 12 }} />
              )}
              {isTree ? (
                isCollapsed ? (
                  <Folder size={13} className="text-subtle" />
                ) : (
                  <FolderOpen size={13} className="text-subtle" />
                )
              ) : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? (
                <FileCode2 size={13} className="text-subtle" />
              ) : (
                <FileText size={13} className="text-subtle" />
              )}
              <span className="truncate" style={{ flex: 1 }}>
                {entry.name}
              </span>
              {!isTree && <span className="row-sub">{formatSize(entry.size)}</span>}
            </div>
          )
        })}
      </div>
      <div className="commit-tree-content">
        {!selected ? (
          <div className="diff-empty">从文件树中选择一个文件</div>
        ) : contentQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : contentQuery.data?.binary ? (
          <div className="binary-note">
            二进制文件，大小 {formatSize(contentQuery.data.size)}
          </div>
        ) : (
          <pre className="commit-file-content">{contentQuery.data?.content ?? ''}</pre>
        )}
      </div>
    </div>
  )
}
