import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import type { FileChange } from '../../lib/types'
import { statusMeta } from '../../lib/format'

interface DirectoryNode {
  name: string
  path: string
  directories: DirectoryNode[]
  files: FileChange[]
}

function buildTree(files: FileChange[]): DirectoryNode {
  const root: DirectoryNode = { name: '', path: '', directories: [], files: [] }
  for (const file of files) {
    const parts = file.path.split('/')
    let current = root
    for (const part of parts.slice(0, -1)) {
      let directory = current.directories.find((item) => item.name === part)
      if (!directory) {
        directory = {
          name: part,
          path: current.path ? `${current.path}/${part}` : part,
          directories: [],
          files: []
        }
        current.directories.push(directory)
      }
      current = directory
    }
    current.files.push(file)
  }
  const sort = (directory: DirectoryNode) => {
    directory.directories.sort((a, b) => a.name.localeCompare(b.name))
    directory.files.sort((a, b) => a.path.localeCompare(b.path))
    directory.directories.forEach(sort)
  }
  sort(root)
  return root
}

function aggregate(directory: DirectoryNode) {
  return [...directory.files, ...directory.directories.flatMap((item) => allFiles(item))].reduce(
    (total, file) => ({
      additions: total.additions + file.additions,
      deletions: total.deletions + file.deletions
    }),
    { additions: 0, deletions: 0 }
  )
}

function allFiles(directory: DirectoryNode): FileChange[] {
  return [
    ...directory.files,
    ...directory.directories.flatMap((item) => allFiles(item))
  ]
}

export default function CommitFileTree({
  files,
  selectedPath,
  onSelect
}: {
  files: FileChange[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const tree = useMemo(() => buildTree(files), [files])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const totals = aggregate(tree)

  const renderFile = (file: FileChange, depth: number) => {
    const meta = statusMeta[file.status] ?? statusMeta.modified
    const name = file.path.split('/').at(-1) ?? file.path
    return (
      <div
        key={file.path}
        className={`detail-file ${selectedPath === file.path ? 'active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onSelect(file.path)}
        title={file.path}
      >
        <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
        <span className="path">{name}</span>
        {file.binary ? (
          <span className="text-subtle text-[10px]">binary</span>
        ) : (
          <>
            <span className="add-count">+{file.additions}</span>
            <span className="del-count">-{file.deletions}</span>
          </>
        )}
      </div>
    )
  }

  const renderDirectory = (directory: DirectoryNode, depth: number) => {
    const isCollapsed = !!collapsed[directory.path]
    const stats = aggregate(directory)
    return (
      <div key={directory.path}>
        <div
          className="detail-file"
          style={{ paddingLeft: 8 + depth * 14, fontWeight: 600 }}
          onClick={() =>
            setCollapsed((current) => ({
              ...current,
              [directory.path]: !current[directory.path]
            }))
          }
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {isCollapsed ? (
            <Folder size={13} className="text-subtle" />
          ) : (
            <FolderOpen size={13} className="text-subtle" />
          )}
          <span className="path">{directory.name}</span>
          <span className="row-sub">{allFiles(directory).length}</span>
          <span className="add-count">+{stats.additions}</span>
          <span className="del-count">-{stats.deletions}</span>
        </div>
        {!isCollapsed && (
          <>
            {directory.directories.map((child) => renderDirectory(child, depth + 1))}
            {directory.files.map((file) => renderFile(file, depth + 1))}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="detail-files commit-file-tree">
      <div className="commit-file-summary">
        <span>{files.length} 个修改文件</span>
        <span className="add-count">+{totals.additions}</span>
        <span className="del-count">-{totals.deletions}</span>
      </div>
      {tree.directories.map((directory) => renderDirectory(directory, 0))}
      {tree.files.map((file) => renderFile(file, 0))}
    </div>
  )
}
