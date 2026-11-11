import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from './ipc'
import type { DiffDto, LogQuery } from './types'

function repoQueryKey(domain: string, repoId: string | null, ...params: unknown[]) {
  return [domain, repoId, ...params] as const
}

export function useStatus(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('status', path),
    queryFn: () => ipc.statusGet(path as string),
    enabled: !!path
  })
}

export function useBranches(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('branches', path),
    queryFn: () => ipc.branchesList(path as string),
    enabled: !!path
  })
}

export function useTags(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('tags', path),
    queryFn: () => ipc.tagsList(path as string),
    enabled: !!path
  })
}

export function useRemotes(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('remotes', path),
    queryFn: () => ipc.remoteList(path as string),
    enabled: !!path
  })
}

export function useStashes(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('stashes', path),
    queryFn: () => ipc.stashList(path as string),
    enabled: !!path
  })
}

export function useConflicts(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('conflicts', path),
    queryFn: () => ipc.conflictList(path as string),
    enabled: !!path
  })
}

export function useSubmodules(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('submodules', path),
    queryFn: () => ipc.submoduleList(path as string),
    enabled: !!path
  })
}

export function useWorktrees(path: string | null) {
  return useQuery({
    queryKey: repoQueryKey('worktrees', path),
    queryFn: () => ipc.worktreeList(path as string),
    enabled: !!path
  })
}

export function useRecentRepos() {
  return useQuery({
    queryKey: ['recent'],
    queryFn: () => ipc.repoRecent()
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => ipc.settingsGet() })
}

export function useLog(path: string | null, query: LogQuery) {
  return useQuery({
    queryKey: repoQueryKey('log', path, query),
    queryFn: () => ipc.logQuery(path as string, query),
    enabled: !!path,
    placeholderData: (previous) => previous
  })
}

export function useCommitDetail(path: string | null, oid: string | null) {
  return useQuery({
    queryKey: repoQueryKey('commit', path, oid),
    queryFn: () => ipc.commitDetail(path as string, oid as string),
    enabled: !!path && !!oid
  })
}

export function useWorkdirDiff(
  path: string | null,
  file: string | null,
  staged: boolean,
  ignoreWhitespace = false,
  contextLines = 3
) {
  return useQuery<DiffDto>({
    queryKey: repoQueryKey(
      'diff',
      path,
      'workdir',
      file,
      staged,
      ignoreWhitespace,
      contextLines
    ),
    queryFn: () =>
      ipc.diffWorkdir(
        path as string,
        file as string,
        staged,
        ignoreWhitespace,
        contextLines
      ),
    enabled: !!path && !!file,
    retry: false
  })
}

export function useCommitDiff(
  path: string | null,
  oid: string | null,
  file: string | null,
  ignoreWhitespace = false,
  contextLines = 3
) {
  return useQuery<DiffDto>({
    queryKey: repoQueryKey(
      'diff',
      path,
      'commit',
      oid,
      file,
      ignoreWhitespace,
      contextLines
    ),
    queryFn: () =>
      ipc.diffCommit(
        path as string,
        oid as string,
        file as string,
        ignoreWhitespace,
        contextLines
      ),
    enabled: !!path && !!oid && !!file,
    retry: false
  })
}

export function useInvalidateRepo(path: string | null) {
  const client = useQueryClient()
  return useCallback(() => {
    if (!path) return
    for (const key of [
      'status',
      'log',
      'branches',
      'tags',
      'remotes',
      'stashes',
      'conflicts',
      'submodules',
      'worktrees',
      'commit',
      'diff'
    ]) {
      client.invalidateQueries({ queryKey: [key, path] })
    }
  }, [client, path])
}
