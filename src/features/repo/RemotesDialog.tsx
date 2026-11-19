import { useId, useState } from 'react'
import { Cloud, Pencil, Plus, Trash2 } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo, useRemotes } from '../../lib/queries'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import { ConfirmDialog } from '../../components/Dialogs'
import { Spinner } from '../../components/Empty'
import type { RemoteDto } from '../../lib/types'

export default function RemotesDialog({ onClose }: { onClose: () => void }) {
  const repo = useApp((s) => s.repo)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const { data: remotes = [], isLoading } = useRemotes(repo?.path ?? null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [editing, setEditing] = useState<RemoteDto | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const editNameId = useId()
  const editUrlId = useId()

  if (!repo) return null

  const addRemote = async () => {
    if (!name.trim() || !url.trim() || busy) return
    setBusy(true)
    try {
      await ipc.remoteAdd(repo.path, name.trim(), url.trim())
      invalidate()
      toast('success', `已添加远程 ${name.trim()}`)
      setName('')
      setUrl('')
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const removeRemote = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      await ipc.remoteRemove(repo.path, removeTarget)
      invalidate()
      toast('success', `已删除远程 ${removeTarget}`)
      if (editing?.name === removeTarget) setEditing(null)
      setRemoveTarget(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (remote: RemoteDto) => {
    setEditing(remote)
    setEditName(remote.name)
    setEditUrl(remote.url)
  }

  const saveRemote = async () => {
    if (!editing || !editName.trim() || !editUrl.trim() || busy) return
    setBusy(true)
    try {
      await ipc.remoteUpdate(repo.path, editing.name, editName.trim(), editUrl.trim())
      invalidate()
      toast('success', `已更新远程 ${editName.trim()}`)
      setEditing(null)
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        title="远程仓库"
        onClose={onClose}
        footer={
          <>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              关闭
            </button>
          </>
        }
      >
        <div className="field">
          <div className="label">现有远程</div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <Spinner /> 读取中…
            </div>
          ) : remotes.length === 0 ? (
            <div className="text-[12px] text-[var(--text-subtle)]">尚未配置远程仓库。</div>
          ) : (
            <div className="flex flex-col gap-1">
              {remotes.map((remote) => (
                <div key={remote.name} className="list-row" title={remote.url}>
                  <Cloud size={13} className="text-subtle" />
                  <span className="mono text-[12px]" style={{ width: 88, flex: '0 0 88px' }}>
                    {remote.name}
                  </span>
                  <span
                    className="truncate text-[11.5px] text-[var(--text-muted)]"
                    style={{ flex: 1 }}
                  >
                    {remote.url}
                  </span>
                  <button
                    className="icon-btn"
                    title={`编辑远程 ${remote.name}`}
                    onClick={() => startEdit(remote)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-btn"
                    title={`删除远程 ${remote.name}`}
                    onClick={() => setRemoveTarget(remote.name)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="remote-edit-form">
              <div className="field">
                <label className="label" htmlFor={editNameId}>
                  remote 名称
                </label>
                <input
                  id={editNameId}
                  className="input mono"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={editUrlId}>
                  remote URL
                </label>
                <input
                  id={editUrlId}
                  className="input mono"
                  value={editUrl}
                  onChange={(event) => setEditUrl(event.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn btn-sm" onClick={() => setEditing(null)} disabled={busy}>
                  取消
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => void saveRemote()}
                  disabled={busy || !editName.trim() || !editUrl.trim()}
                >
                  {busy ? '保存中…' : '保存修改'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <div className="field">
          <div className="label">添加远程</div>
          <div className="flex items-center gap-2">
            <input
              className="input"
              style={{ width: 140, flex: '0 0 140px' }}
              value={name}
              placeholder="名称，如 origin"
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              value={url}
              placeholder="URL，如 git@github.com:user/repo.git"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addRemote()
              }}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !name.trim() || !url.trim()}
              onClick={addRemote}
            >
              <Plus size={14} />
              添加
            </button>
          </div>
        </div>

        <div className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
          认证沿用系统 git 的 credential helper / SSH agent，GitEasy 不存储凭据。
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title="删除远程"
        danger
        confirmLabel="删除"
        busy={busy}
        message={
          <span>
            确定删除远程 <span className="mono">{removeTarget}</span>{' '}
            吗？此操作只影响本地配置，不会删除远程服务器上的仓库。
          </span>
        }
        onCancel={() => setRemoveTarget(null)}
        onConfirm={removeRemote}
      />
    </>
  )
}
