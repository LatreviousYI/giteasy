import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConflictFile } from '../../lib/types'
import type { ConflictChoice } from '../../lib/conflict'
import {
  applyAllConflictChoices,
  applyConflictChoice,
  beginConflictEdit,
  createConflictSession,
  endConflictEdit,
  navigateConflictBlock,
  selectConflictBlock,
  undoConflictSession,
  updateConflictSessionContent,
  type ConflictFileSession
} from './conflictSessions'

export function useConflictSessions(files: ConflictFile[]) {
  const [sessions, setSessions] = useState<Record<string, ConflictFileSession>>({})
  const fileMap = useMemo(() => new Map(files.map((file) => [file.path, file])), [files])

  useEffect(() => {
    setSessions((previous) => {
      const next: Record<string, ConflictFileSession> = {}
      for (const file of files) {
        next[file.path] = previous[file.path] ?? createConflictSession(file.path, file.result)
      }
      return next
    })
  }, [files])

  const update = useCallback(
    (path: string, transform: (session: ConflictFileSession) => ConflictFileSession) => {
      setSessions((previous) => {
        const file = fileMap.get(path)
        const current =
          previous[path] ?? (file ? createConflictSession(path, file.result) : undefined)
        if (!current) return previous
        const next = transform(current)
        return next === current ? previous : { ...previous, [path]: next }
      })
    },
    [fileMap]
  )

  const navigate = useCallback(
    (path: string, direction: 'previous' | 'next') =>
      update(path, (session) => navigateConflictBlock(session, direction)),
    [update]
  )

  const selectBlock = useCallback(
    (path: string, index: number) => update(path, (session) => selectConflictBlock(session, index)),
    [update]
  )

  const applyChoice = useCallback(
    (path: string, choice: ConflictChoice) =>
      update(path, (session) => applyConflictChoice(session, choice)),
    [update]
  )

  const applyAll = useCallback(
    (path: string, choice: ConflictChoice) =>
      update(path, (session) => applyAllConflictChoices(session, choice)),
    [update]
  )

  const beginEdit = useCallback((path: string) => update(path, beginConflictEdit), [update])

  const updateContent = useCallback(
    (path: string, content: string) =>
      update(path, (session) => updateConflictSessionContent(session, content)),
    [update]
  )

  const endEdit = useCallback((path: string) => update(path, endConflictEdit), [update])

  const undo = useCallback((path: string) => update(path, undoConflictSession), [update])

  const remove = useCallback((path: string) => {
    setSessions((previous) => {
      if (!previous[path]) return previous
      const next = { ...previous }
      delete next[path]
      return next
    })
  }, [])

  return {
    sessions,
    navigate,
    selectBlock,
    applyChoice,
    applyAll,
    beginEdit,
    updateContent,
    endEdit,
    undo,
    remove
  }
}
