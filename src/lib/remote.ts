import { useCallback } from 'react'
import { ipc } from './ipc'
import { useInvalidateRepo, useRemotes, useStatus } from './queries'
import { isHostKeyError } from './errors'
import { useApp } from '../store/app'
import { effectivePullMode, isDiverged } from './pull'
import type { ProgressEvent, PullMode } from './types'

export type RemoteAction = 'fetch' | 'pull' | 'push'

export function useRemoteActions() {
  const repo = useApp((s) => s.repo)
  const setProgress = useApp((s) => s.setProgress)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const { data: status } = useStatus(repo?.path ?? null)
  const { data: remotes = [] } = useRemotes(repo?.path ?? null)
  const invalidate = useInvalidateRepo(repo?.path ?? null)

  const runRemote = useCallback(
    async (
      kind: RemoteAction,
      force = false,
      targetRemote?: string | null,
      requestedPullMode: PullMode = 'auto'
    ) => {
      if (!repo) return
      const branch = status?.branch ?? repo.branch
      const upstreamRemote = status?.upstream?.split('/')[0] ?? null
      const preferredRemote =
        (upstreamRemote && remotes.some((item) => item.name === upstreamRemote)
          ? upstreamRemote
          : null) ??
        remotes.find((item) => item.name === 'origin')?.name ??
        remotes[0]?.name ??
        null
      const remoteName = targetRemote ?? preferredRemote

      if (kind !== 'fetch' && remotes.length === 0) {
        errorToast({
          kind: 'user',
          code: 'E_NO_REMOTE',
          message: '尚未配置远程仓库',
          hint: '在仓库菜单 → 管理远程 中添加远程后重试'
        })
        return
      }
      if (kind !== 'fetch' && !branch) {
        errorToast({
          kind: 'user',
          code: 'E_DETACHED',
          message: '当前处于分离头指针，无法确定分支',
          hint: '请先检出一个本地分支再执行该操作'
        })
        return
      }

      setProgress({
        phase: 'start',
        percent: null,
        message: `${kind} 开始`,
        done: false,
        error: null
      })
      const onProgress = (event: ProgressEvent) => setProgress(event)

      try {
        if (kind === 'fetch') {
          await ipc.fetch(repo.path, null, onProgress)
        } else if (kind === 'pull') {
          const savedStrategy =
            useApp.getState().repoStates[repo.path]?.pullStrategy ?? null
          const mode = effectivePullMode(requestedPullMode, savedStrategy)
          if (mode === 'auto') {
            await ipc.fetch(repo.path, remoteName, onProgress)
            const preview = await ipc.statusGet(repo.path)
            invalidate()
            if (isDiverged(preview)) {
              setProgress(null)
              useApp.getState().setPullPrompt({
                repoPath: repo.path,
                remoteName,
                branch: preview.branch ?? branch!,
                ahead: preview.ahead,
                behind: preview.behind
              })
              return
            }
          }
          // 已有上游时交给 git 使用默认 upstream，避免分支名不一致导致拉错
          if (status?.upstream) await ipc.pull(repo.path, null, null, mode, onProgress)
          else await ipc.pull(repo.path, remoteName, branch, mode, onProgress)
        } else if (targetRemote) {
          // 显式推送到指定远程
          await ipc.push(repo.path, targetRemote, branch, null, force, false, onProgress)
        } else if (status?.upstream) {
          await ipc.push(repo.path, null, null, null, force, false, onProgress)
        } else {
          // 新远程 / 未设置上游：显式指定 remote + branch，并用 -u 建立跟踪
          await ipc.push(repo.path, remoteName, branch, null, force, true, onProgress)
        }
        setProgress(null)
        invalidate()
        const label = kind === 'fetch' ? 'Fetch' : kind === 'pull' ? 'Pull' : 'Push'
        toast('success', `${label} 完成`)
      } catch (error) {
        setProgress(null)
        if (kind === 'pull' && (error as { kind?: string })?.kind === 'conflict') {
          invalidate()
          useApp.getState().setPullPrompt(null)
          useApp.getState().setView('conflicts')
          toast('warn', '拉取产生冲突', {
            message: '请在冲突页解决并标记全部文件后继续 Pull。'
          })
          return
        }
        if (kind !== 'fetch' && isHostKeyError(error)) {
          const probeRemote =
            targetRemote ?? status?.upstream?.split('/')[0] ?? preferredRemote
          if (probeRemote) {
            try {
              const probe = await ipc.sshProbeRemote(repo.path, probeRemote)
              useApp.getState().setSshPrompt({
                repoPath: repo.path,
                remote: probeRemote,
                host: probe.host,
                keys: probe.keys,
                fingerprints: probe.fingerprints,
                retry: () => {
                  void runRemote(kind, force, targetRemote)
                }
              })
              return
            } catch (probeError) {
              errorToast(probeError)
              return
            }
          }
        }
        errorToast(error)
      }
    },
    [repo, status, remotes, setProgress, toast, errorToast, invalidate]
  )

  return { runRemote, hasRemote: remotes.length > 0, remotes }
}
