import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import type { Settings, SshPublicKey } from '../../lib/types'
import UpdateSection from './UpdateSection'

export default function SettingsDialog() {
  const close = () => useApp.getState().setSettingsOpen(false)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)

  const [form, setForm] = useState<Settings>(
    settings ?? {
      theme: 'system',
      monoFont: 'JetBrains Mono',
      fontSize: 13,
      externalEditor: '',
      terminal: '',
      autoFetchMinutes: 0,
      gpgSign: false,
      gpgKey: '',
      externalDiffTools: [],
      externalMergeTools: [],
      customCommands: [],
      recent: []
    }
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sshKey, setSshKey] = useState<SshPublicKey | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  useEffect(() => {
    ipc
      .identityGet()
      .then((identity) => {
        setName(identity.name)
        setEmail(identity.email)
      })
      .catch(() => undefined)
    ipc
      .sshPublicKey()
      .then(setSshKey)
      .catch(() => undefined)
  }, [])

  const copyPublicKey = async () => {
    if (!sshKey?.exists) return
    try {
      await navigator.clipboard.writeText(sshKey.content)
      toast('success', 'SSH 公钥已复制')
    } catch {
      toast('warn', '无法访问剪贴板')
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const updated = await ipc.settingsSet(form)
      if (name.trim() || email.trim()) {
        await ipc.identitySet(name, email)
      }
      setSettings(updated)
      toast('success', '设置已保存')
      close()
    } catch (error) {
      errorToast(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="设置"
      onClose={close}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={close} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存设置'}
          </button>
        </>
      }
    >
      <div className="field">
        <div className="label">外观主题</div>
        <div className="seg" style={{ width: 'fit-content' }}>
          <button
            className={form.theme === 'light' ? 'active' : ''}
            onClick={() => setForm({ ...form, theme: 'light' })}
          >
            <Sun size={12} style={{ display: 'inline', marginRight: 4 }} />
            浅色
          </button>
          <button
            className={form.theme === 'dark' ? 'active' : ''}
            onClick={() => setForm({ ...form, theme: 'dark' })}
          >
            <Moon size={12} style={{ display: 'inline', marginRight: 4 }} />
            深色
          </button>
          <button
            className={form.theme === 'system' ? 'active' : ''}
            onClick={() => setForm({ ...form, theme: 'system' })}
          >
            <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
            跟随系统
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">代码字号</label>
          <input
            className="input"
            type="number"
            min={10}
            max={20}
            value={form.fontSize}
            onChange={(event) =>
              setForm({ ...form, fontSize: Number(event.target.value) || 13 })
            }
          />
        </div>
        <div className="field">
          <label className="label">自动 Fetch 间隔（分钟，0 为关闭）</label>
          <input
            className="input"
            type="number"
            min={0}
            max={120}
            value={form.autoFetchMinutes}
            onChange={(event) =>
              setForm({ ...form, autoFetchMinutes: Number(event.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 items-end">
        <label className="check" style={{ height: 32 }}>
          <input
            type="checkbox"
            checked={form.gpgSign}
            onChange={(event) => setForm({ ...form, gpgSign: event.target.checked })}
          />
          GPG 签名
        </label>
        <div className="field">
          <label className="label">GPG Key ID（可选）</label>
          <input
            className="input mono"
            value={form.gpgKey}
            onChange={(event) => setForm({ ...form, gpgKey: event.target.value })}
            placeholder="留空使用默认签名密钥"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">外部 Diff 工具（每行一个）</label>
          <textarea
            className="textarea mono"
            value={form.externalDiffTools.join('\n')}
            onChange={(event) =>
              setForm({
                ...form,
                externalDiffTools: event.target.value
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean)
              })
            }
            placeholder="code --diff"
          />
        </div>
        <div className="field">
          <label className="label">外部 Merge 工具（每行一个）</label>
          <textarea
            className="textarea mono"
            value={form.externalMergeTools.join('\n')}
            onChange={(event) =>
              setForm({
                ...form,
                externalMergeTools: event.target.value
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean)
              })
            }
            placeholder="code --merge"
          />
        </div>
      </div>

      <div className="field">
        <label className="label">等宽字体</label>
        <input
          className="input"
          value={form.monoFont}
          placeholder="JetBrains Mono"
          onChange={(event) => setForm({ ...form, monoFont: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">外部编辑器命令</label>
          <input
            className="input"
            value={form.externalEditor}
            placeholder="code / gedit / xdg-open"
            onChange={(event) => setForm({ ...form, externalEditor: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="label">终端命令</label>
          <input
            className="input"
            value={form.terminal}
            placeholder="x-terminal-emulator"
            onChange={(event) => setForm({ ...form, terminal: event.target.value })}
          />
        </div>
      </div>

      <div
        style={{ height: 1, background: 'var(--border)', margin: '2px 0' }}
      />

      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          提交身份（写入全局 git config）
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label className="label">user.name</label>
            <input
              className="input"
              value={name}
              placeholder="你的名字"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">user.email</label>
            <input
              className="input"
              value={email}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--text-subtle)] leading-relaxed">
        GitEasy 不存储任何凭据，推送认证完全交由系统 git 的 credential helper / SSH agent 处理。
      </div>

      <UpdateSection />

      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="label" style={{ marginBottom: 0 }}>
            SSH 公钥
          </div>
          <span className="text-[10.5px] text-[var(--text-subtle)] truncate">
            {sshKey?.path}
          </span>
          <span style={{ flex: 1 }} />
          {sshKey?.exists && (
            <button className="btn btn-sm" onClick={copyPublicKey}>
              复制公钥
            </button>
          )}
        </div>
        {sshKey?.exists ? (
          <textarea
            className="textarea mono"
            readOnly
            style={{ minHeight: 72, fontSize: 11, lineHeight: 1.5 }}
            value={sshKey.content}
          />
        ) : (
          <div className="text-[11.5px] text-[var(--text-subtle)]">
            未找到 ~/.ssh/id_*.pub，请先在终端执行 ssh-keygen 生成 SSH 密钥。
          </div>
        )}
        <div className="text-[11px] text-[var(--text-subtle)] leading-relaxed" style={{ marginTop: 6 }}>
          将公钥添加到 Gitee / GitHub 等平台的 SSH 公钥设置中，即可通过 SSH 推送。
        </div>
      </div>
    </Modal>
  )
}
