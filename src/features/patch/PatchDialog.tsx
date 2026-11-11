import { useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Clipboard, FileDown, FolderOpen, Play, ShieldCheck } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'

type PatchKind = 'worktree' | 'commit' | 'range' | 'stash'

export default function PatchDialog() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setPatchOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const [kind, setKind] = useState<PatchKind>('worktree')
  const [left, setLeft] = useState('HEAD~1')
  const [right, setRight] = useState('HEAD')
  const [file, setFile] = useState('')
  const [patch, setPatch] = useState('')
  const [busy, setBusy] = useState(false)

  if (!repo) return null

  const generate = async () => {
    setBusy(true)
    try {
      const text = await ipc.generatePatch(
        repo.path,
        kind,
        kind === 'worktree' ? null : left || null,
        kind === 'range' ? right || null : null,
        file || null
      )
      setPatch(text)
      if (!text.trim()) toast('info', '当前来源没有可导出的 Patch')
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const savePatch = async () => {
    if (!patch.trim()) return
    try {
      const target = await save({
        defaultPath: `${repo.name}.patch`,
        filters: [{ name: 'Patch', extensions: ['patch', 'diff'] }]
      })
      if (typeof target !== 'string') return
      await ipc.savePatchFile(target, patch)
      toast('success', 'Patch 已保存')
    } catch (error) {
      errorToast(error)
    }
  }

  const choosePatchFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Patch', extensions: ['patch', 'diff'] }]
      })
      if (typeof selected === 'string') {
        const text = await ipc.readPatchFile(selected)
        setPatch(text)
      }
    } catch (error) {
      errorToast(error)
    }
  }

  const applyPatch = async (checkOnly: boolean) => {
    if (!patch.trim()) return
    setBusy(true)
    try {
      await ipc.applyPatchText(repo.path, patch, checkOnly)
      if (!checkOnly) {
        invalidate()
        toast('success', 'Patch 已应用')
      } else {
        toast('success', 'Patch 校验通过，可安全应用')
      }
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  const copyPatch = async () => {
    try {
      await navigator.clipboard.writeText(patch)
      toast('success', 'Patch 已复制')
    } catch {
      toast('warn', '无法访问剪贴板')
    }
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <FileDown size={15} />
          Patch 工具
        </span>
      }
      onClose={close}
      footer={
        <>
          <button className="btn btn-sm" onClick={choosePatchFile} disabled={busy}>
            <FolderOpen size={13} />
            打开 Patch
          </button>
          <span className="spacer" />
          <button className="btn" onClick={copyPatch} disabled={!patch.trim()}>
            <Clipboard size={13} />
            复制
          </button>
          <button className="btn" onClick={savePatch} disabled={!patch.trim()}>
            保存
          </button>
          <button
            className="btn"
            onClick={() => applyPatch(true)}
            disabled={!patch.trim() || busy}
          >
            <ShieldCheck size={13} />
            冲突校验
          </button>
          <button
            className="btn btn-primary"
            onClick={() => applyPatch(false)}
            disabled={!patch.trim() || busy}
          >
            <Play size={13} />
            应用 Patch
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
        <select
          className="select"
          value={kind}
          onChange={(event) => setKind(event.target.value as PatchKind)}
        >
          <option value="worktree">工作区</option>
          <option value="commit">提交</option>
          <option value="range">提交范围</option>
          <option value="stash">Stash</option>
        </select>
        {kind === 'worktree' ? (
          <input
            className="input mono"
            value={file}
            onChange={(event) => setFile(event.target.value)}
            placeholder="可选：限定文件路径"
          />
        ) : (
          <div className="flex gap-2">
            <input
              className="input mono"
              value={left}
              onChange={(event) => setLeft(event.target.value)}
              placeholder={kind === 'stash' ? 'stash@{0}' : '起点 / 提交'}
            />
            {kind === 'range' && (
              <input
                className="input mono"
                value={right}
                onChange={(event) => setRight(event.target.value)}
                placeholder="终点"
              />
            )}
            <input
              className="input mono"
              value={file}
              onChange={(event) => setFile(event.target.value)}
              placeholder="可选文件"
            />
          </div>
        )}
      </div>
      <button className="btn" onClick={generate} disabled={busy}>
        {busy ? '生成中…' : '生成 Patch'}
      </button>
      <textarea
        className="textarea mono"
        value={patch}
        onChange={(event) => setPatch(event.target.value)}
        placeholder="生成、粘贴或打开一个 Patch 文件"
        style={{ minHeight: '48vh', whiteSpace: 'pre' }}
        spellCheck={false}
      />
    </Modal>
  )
}
