import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import { ipc } from '../lib/ipc'
import { useApp } from '../store/app'

export default function SshTrustDialog() {
  const prompt = useApp((s) => s.sshPrompt)
  const setPrompt = useApp((s) => s.setSshPrompt)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const [busy, setBusy] = useState(false)

  if (!prompt) return null

  const trust = async () => {
    setBusy(true)
    try {
      await ipc.sshTrustRemote(prompt.repoPath, prompt.remote, prompt.keys)
      toast('success', `已信任 ${prompt.host} 的主机密钥`)
      const retry = prompt.retry
      setPrompt(null)
      retry()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert size={15} />
          确认 SSH 主机密钥
        </span>
      }
      onClose={() => setPrompt(null)}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={() => setPrompt(null)} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={trust} disabled={busy}>
            {busy ? '写入中…' : '信任并重试'}
          </button>
        </>
      }
    >
      <div className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        首次通过 SSH 连接 <b className="mono">{prompt.host}</b>，需要确认主机指纹。
        请与代码托管平台公布的指纹核对后再信任。
      </div>

      <div className="field">
        <div className="label">主机指纹</div>
        <div
          className="mono text-[11px] leading-relaxed"
          style={{
            background: 'var(--bg-alt)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px',
            wordBreak: 'break-all'
          }}
        >
          {prompt.fingerprints.length > 0
            ? prompt.fingerprints.map((line) => <div key={line}>{line}</div>)
            : '（未能读取指纹，可展开查看主机密钥）'}
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-[11.5px] text-[var(--text-muted)]">
          查看主机密钥
        </summary>
        <pre className="toast-detail" style={{ maxHeight: 160, marginTop: 6 }}>
          {prompt.keys.join('\n')}
        </pre>
      </details>

      <div className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        确认后会将该主机的密钥追加到 <span className="mono">~/.ssh/known_hosts</span>，随后自动重试刚才的操作。
      </div>
    </Modal>
  )
}
