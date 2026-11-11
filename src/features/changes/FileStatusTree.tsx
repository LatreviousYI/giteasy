import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Minus,
  Plus,
  Undo2
} from 'lucide-react'
import type { FileStatus } from '../../lib/types'
import { statusMeta, statusOf } from '../../lib/format'

interface DirectoryNode {
  name: string
  path: string
  directories: DirectoryNode[]
  files: FileStatus[]
}

function buildTree(files: FileStatus[]): DirectoryNode {
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
    current.files.push({ ...file, path: file.path })
  }

  const sortDirectory = (directory: DirectoryNode) => {
    directory.directories.sort((a, b) => a.name.localeCompare(b.name))
    directory.files.sort((a, b) => a.path.localeCompare(b.path))
    directory.directories.forEach(sortDirectory)
  }
  sortDirectory(root)
  return root
}

function filesBelow(directory: DirectoryNode): string[] {
  return [
    ...directory.files.map((file) => file.path),
    ...directory.directories.flatMap(filesBelow)
  ]
}

interface FileStatusTreeProps {
  title: string
  files: FileStatus[]
  groupStaged: boolean
  actionLabel?: string
  selectedFile: string | null
  selectedStaged: boolean
  busy: boolean
  onSelect: (file: string, staged: boolean) => void
  onStage: (paths: string[], stage: boolean) => void
  onDiscard: (file: FileStatus) => void
  onResolveConflict: () => void
}

export default function FileStatusTree({
  title,
  files,
  groupStaged,
  actionLabel,
  selectedFile,
  selectedStaged,
  busy,
  onSelect,
  onStage,
  onDiscard,
  onResolveConflict
}: FileStatusTreeProps) {
  const tree = useMemo(() => buildTree(files), [files])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (files.length === 0) return null

  const toggleDirectory = (path: string) => {
    setCollapsed((current) => ({ ...current, [path]: !current[path] }))
  }

  const handleTreeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== ' ') {
      return
    }
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-file-row="true"]')
    )
    if (rows.length === 0) return
    const currentIndex = rows.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      rows[Math.min(rows.length - 1, currentIndex + 1)]?.focus()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      rows[Math.max(0, currentIndex - 1)]?.focus()
      return
    }
    if (event.key === ' ' && currentIndex >= 0) {
      event.preventDefault()
      const path = rows[currentIndex].dataset.filePath
      if (path) onStage([path], !groupStaged)
    }
  }

  const renderDirectory = (directory: DirectoryNode, depth: number): ReactNode => {
    const isCollapsed = !!collapsed[directory.path]
    const directoryFiles = filesBelow(directory)
    return (
      <div key={`dir:${directory.path}`}>
        <div
          className="file-row tree-directory-row"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggleDirectory(directory.path)}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {isCollapsed ? (
            <Folder size={13} className="text-subtle" />
          ) : (
            <FolderOpen size={13} className="text-subtle" />
          )}
          <span className="file-name" style={{ flex: 1 }}>
            {directory.name}
          </span>
          <span className="row-sub">{directoryFiles.length}</span>
          <button
            className="icon-btn"
            title={groupStaged ? '取消暂存此目录' : '暂存此目录'}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              onStage(directoryFiles, !groupStaged)
            }}
          >
            {groupStaged ? <Minus size={13} /> : <Plus size={13} />}
          </button>
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

  const renderFile = (file: FileStatus, depth: number) => {
    const meta = statusMeta[statusOf(file)] ?? statusMeta.modified
    const active = selectedFile === file.path && selectedStaged === groupStaged
    const name = file.path.split('/').at(-1) ?? file.path
    return (
      <div
        key={`file:${groupStaged}:${file.path}`}
        className={`file-row ${active ? 'active' : ''}`}
        style={{ paddingLeft: 18 + depth * 14 }}
        tabIndex={0}
        data-file-row="true"
        data-file-path={file.path}
        onClick={() => onSelect(file.path, groupStaged)}
      >
        <span className={`file-letter ${meta.className}`}>{meta.letter}</span>
        <div className="file-row-main">
          <div className="file-label">
            <span className="file-name">{name}</span>
          </div>
        </div>
        <div className="file-actions">
          {file.conflicted ? (
            <button
              className="icon-btn"
              title="去解决冲突"
              onClick={(event) => {
                event.stopPropagation()
                onResolveConflict()
              }}
            >
              <AlertTriangle size={14} />
            </button>
          ) : (
            <>
              <button
                className="icon-btn"
                title={groupStaged ? '取消暂存' : '暂存'}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation()
                  onStage([file.path], !groupStaged)
                }}
              >
                {groupStaged ? <Minus size={14} /> : <Plus size={14} />}
              </button>
              <button
                className="icon-btn"
                title="丢弃改动"
                onClick={(event) => {
                  event.stopPropagation()
                  onDiscard(file)
                }}
              >
                <Undo2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="group-head">
        <span>{title}</span>
        <span className="count">{files.length}</span>
        <span className="spacer" />
        {actionLabel && (
          <button
            disabled={busy}
            onClick={() => onStage(files.map((file) => file.path), !groupStaged)}
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div onKeyDown={handleTreeKey}>
        {tree.directories.map((directory) => renderDirectory(directory, 0))}
        {tree.files.map((file) => renderFile(file, 0))}
      </div>
    </div>
  )
}
