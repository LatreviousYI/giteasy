import { useState } from 'react'
import { Play, Plus, Trash2, Wrench } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useApp } from '../../store/app'
import Modal from '../../components/Modal'
import type { CustomCommand } from '../../lib/types'

export default function ToolsPanel() {
  const repo = useApp((s) => s.repo)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const close = () => useApp.getState().setToolsOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [kind, setKind] = useState<'shell' | 'url'>('shell')
  const [file, setFile] = useState('')
  const [output, setOutput] = useState('')
  const [tab, setTab] = useState<'commands' | 'external'>('commands')

  if (!repo || !settings) return null

  const saveCommands = async (customCommands: CustomCommand[]) => {
    try {
      const updated = await ipc.settingsSet({ ...settings, customCommands })
      setSettings(updated)
    } catch (error) {
      errorToast(error)
    }
  }

  const runCommand = async (item: CustomCommand) => {
    try {
      const result = await ipc.runCustomCommand(
        repo.path,
        item.name,
        item.command,
        item.kind,
        file || null
      )
      setOutput(result || '命令已执行')
    } catch (error) {
      errorToast(error)
    }
  }

  const addCommand = async () => {
    if (!name.trim() || !command.trim()) return
    await saveCommands([
      ...settings.customCommands,
      { name: name.trim(), command: command.trim(), kind }
    ])
    setName('')
    setCommand('')
    toast('success', '自定义命令已添加')
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <Wrench size={15} />
          工具与自定义命令
        </span>
      }
      onClose={close}
      footer={
        <>
          <span className="text-[11px] text-[var(--text-subtle)]">
            支持变量 {'{repo}'} 和 {'{file}'}
          </span>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={close}>
            关闭
          </button>
        </>
      }
    >
      <div className="seg" style={{ width: 'fit-content' }}>
        <button className={tab === 'commands' ? 'active' : ''} onClick={() => setTab('commands')}>
          自定义命令
        </button>
        <button className={tab === 'external' ? 'active' : ''} onClick={() => setTab('external')}>
          外部工具
        </button>
      </div>

      <div className="field">
        <label className="label">当前文件路径（可选，用于 {'{file}'}）</label>
        <input
          className="input mono"
          value={file}
          onChange={(event) => setFile(event.target.value)}
          placeholder="src/app.ts"
        />
      </div>

      {tab === 'commands' ? (
        <>
          <div className="grid grid-cols-[120px_110px_minmax(0,1fr)_auto] gap-2">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="名称"
            />
            <select
              className="select"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'shell' | 'url')}
            >
              <option value="shell">Shell</option>
              <option value="url">URL</option>
            </select>
            <input
              className="input mono"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="git status --short --branch"
            />
            <button className="btn" onClick={addCommand}>
              <Plus size={13} />
              添加
            </button>
          </div>
          {settings.customCommands.map((item, index) => (
            <div key={`${item.name}-${index}`} className="github-list-row">
              <Wrench size={13} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="github-list-title">{item.name}</div>
                <div className="github-list-sub mono">{item.command}</div>
              </div>
              <span className="row-sub">{item.kind}</span>
              <button className="btn btn-sm" onClick={() => runCommand(item)}>
                <Play size={12} />
                运行
              </button>
              <button
                className="icon-btn"
                title="删除"
                onClick={() =>
                  void saveCommands(
                    settings.customCommands.filter((_, current) => current !== index)
                  )
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          {settings.externalDiffTools.map((tool) => (
            <div key={`diff-${tool}`} className="github-list-row">
              <span className="ref-chip ref-tag">Diff</span>
              <span className="mono truncate" style={{ flex: 1 }}>
                {tool}
              </span>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  if (!file.trim()) {
                    toast('warn', '请先填写文件路径')
                    return
                  }
                  try {
                    await ipc.runExternalTool(repo.path, file, tool, 'diff')
                  } catch (error) {
                    errorToast(error)
                  }
                }}
              >
                运行
              </button>
            </div>
          ))}
          {settings.externalMergeTools.map((tool) => (
            <div key={`merge-${tool}`} className="github-list-row">
              <span className="ref-chip ref-branch">Merge</span>
              <span className="mono truncate" style={{ flex: 1 }}>
                {tool}
              </span>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  if (!file.trim()) {
                    toast('warn', '请先填写文件路径')
                    return
                  }
                  try {
                    await ipc.runExternalTool(repo.path, file, tool, 'merge')
                  } catch (error) {
                    errorToast(error)
                  }
                }}
              >
                运行
              </button>
            </div>
          ))}
          {settings.externalDiffTools.length === 0 &&
            settings.externalMergeTools.length === 0 && (
              <div className="text-[11.5px] text-[var(--text-subtle)]">
                在设置中心添加外部 Diff 或 Merge 工具。
              </div>
            )}
        </>
      )}

      {output && (
        <pre className="conflict-code" style={{ maxHeight: 220 }}>
          {output}
        </pre>
      )}
    </Modal>
  )
}
