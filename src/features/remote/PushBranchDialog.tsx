import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, Cloud } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useBranches, useInvalidateRepo, useRemotes } from '../../lib/queries'
import { isHostKeyError } from '../../lib/errors'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import type { BranchDto, ProgressEvent } from '../../lib/types'

export default function PushBranchDialog({
  branch,
  onClose
}: {
  branch: BranchDto
  onClose: () => void
}) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const { data: remotes = [] } = useRemotes(repo?.path ?? null)
  const { data: branches = [], isLoading: branchesLoading } = useBranches(repo?.path ?? null)
  const invalidate = useInvalidateRepo(repo?.path ?? null)

  const upstreamRemote = branch.upstream?.split('/')[0] ?? null
  const [remoteName, setRemoteName] = useState(
    upstreamRemote ??
      ''
  )
  const [hydratedRemote, setHydratedRemote] = useState<string | null>(null)
  const [mode, setMode] = useState<'existing' | 'new'>('new')
  const [existingTarget, setExistingTarget] = useState('')
  const [newName, setNewName] = useState(branch.name)
  const [setUpstream, setSetUpstream] = useState(true)
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)

  useEffect(() => {
    if (remotes.length === 0) return
    if (remoteName && remotes.some((item) => item.name === remoteName)) return
    const preferred =
      (upstreamRemote && remotes.some((item) => item.name === upstreamRemote)
        ? upstreamRemote
        : null) ??
      remotes.find((item) => item.name === 'origin')?.name ??
      remotes[0].name
    setRemoteName(preferred)
    setHydratedRemote(null)
  }, [remotes, remoteName, upstreamRemote])

  const remoteBranches = useMemo(() => {
    if (!remoteName) return []
    const prefix = `${remoteName}/`
    return branches
      .filter((item) => item.isRemote && item.name.startsWith(prefix))
      .map((item) => item.name.slice(prefix.length))
      .sort()
  }, [branches, remoteName])

  useEffect(() => {
    if (!remoteName || hydratedRemote === remoteName || branchesLoading) return
    if (remoteBranches.includes(branch.name)) {
      setMode('existing')
      setExistingTarget(branch.name)
      setNewName(branch.name)
    } else {
      // 远程还没有同名分支：默认新建，使用本地分支名
      setMode('new')
      setNewName(branch.name)
    }
    setHydratedRemote(remoteName)
  }, [remoteName, remoteBranches, hydratedRemote, branch.name, branchesLoading])

  if (!repo) return null

  const target = mode === 'new' ? newName.trim() : existingTarget
  const canPush = !!remoteName && !!target && !busy

  const push = async () => {
    if (!canPush) return
    setBusy(true)
    setProgress(null)
    try {
      await ipc.push(
        repo.path,
        remoteName,
        branch.name,
        target,
        force,
        setUpstream,
        (event) => setProgress(event)
      )
      invalidate()
      toast('success', `已推送 ${branch.name} → ${remoteName}/${target}`)
      onClose()
    } catch (error) {
      setProgress(null)
      if (isHostKeyError(error)) {
        try {
          const probe = await ipc.sshProbeRemote(repo.path, remoteName)
          useApp.getState().setSshPrompt({
            repoPath: repo.path,
            remote: remoteName,
            host: probe.host,
            keys: probe.keys,
            fingerprints: probe.fingerprints,
            retry: () => {
              void push()
            }
          })
          return
        } catch (probeError) {
          errorToast(probeError)
          return
        }
      }
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const commandPreview = `git push${force ? ' --force-with-lease' : ''}${
    setUpstream ? ' -u' : ''
  } ${remoteName || '<remote>'} ${branch.name}:${target || '<branch>'}`

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <ArrowUp size={15} />
          Push 到远程
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={push} disabled={!canPush}>
            {busy ? '推送中…' : '推送'}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2 text-[12px]">
        <span className="text-[var(--text-muted)]">本地分支</span>
        <span className="branch-chip mono">{branch.name}</span>
        <span className="text-[var(--text-subtle)]">→</span>
        <span className="mono text-[var(--text-secondary)]">
          {remoteName ? `${remoteName}/${target || '…'}` : '尚未配置远程'}
        </span>
      </div>

      {remotes.length === 0 ? (
        <div className="text-[12px] text-[var(--text-subtle)] leading-relaxed">
          当前仓库还没有远程。请先在侧边栏「远程」区域点击 + 添加一个远程，再回到这里推送。
        </div>
      ) : (
        <>
          <div className="field">
            <label className="label">远程仓库</label>
            <select
              className="select"
              value={remoteName}
              onChange={(event) => {
                setRemoteName(event.target.value)
                setHydratedRemote(null)
              }}
            >
              {remotes.map((remote) => (
                <option key={remote.name} value={remote.name}>
                  {remote.name} — {remote.url}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">目标远程分支</label>
            <select
              className="select"
              value={mode === 'new' ? '__new__' : existingTarget}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  setMode('new')
                  if (!newName.trim()) setNewName(branch.name)
                } else {
                  setMode('existing')
                  setExistingTarget(event.target.value)
                }
              }}
            >
              {remoteBranches.map((name) => (
                <option key={name} value={name}>
                  {remoteName}/{name}
                </option>
              ))}
              <option value="__new__">+ 新建远程分支…</option>
            </select>
            {mode === 'new' && (
              <input
                className="input"
                value={newName}
                placeholder="输入新的远程分支名称"
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') push()
                }}
              />
            )}
            {remoteBranches.length === 0 && (
              <div className="text-[11px] text-[var(--text-subtle)]">
                该远程还没有分支，输入名称后会直接创建。
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="check">
              <input
                type="checkbox"
                checked={setUpstream}
                onChange={(event) => setSetUpstream(event.target.checked)}
              />
              推送后设置为上游（-u）
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />
              强制推送（force-with-lease）
            </label>
          </div>

          {progress && (
            <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
              <Cloud size={13} />
              <span>{progress.phase}</span>
              {progress.percent !== null && (
                <span className="progress-track">
                  <span
                    className="progress-fill block"
                    style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                  />
                </span>
              )}
              {progress.percent !== null && <span>{Math.round(progress.percent)}%</span>}
            </div>
          )}

          <div className="mono text-[10.5px] text-[var(--text-subtle)] break-all">
            {commandPreview}
          </div>
        </>
      )}
    </Modal>
  )
}
