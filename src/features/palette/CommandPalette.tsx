import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Archive,
  Activity,
  ArrowDown,
  ArrowUp,
  FolderOpen,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  ListChecks,
  Moon,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sun,
  Terminal
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useInvalidateRepo } from '../../lib/queries'
import { useRemoteActions } from '../../lib/remote'
import { useOpenRepo, pickDirectory } from '../../lib/actions'
import { useApp } from '../../store/app'
import { PromptDialog } from '../../components/Dialogs'

interface Command {
  id: string
  label: string
  hint?: string
  icon: ReactNode
  run: () => void | Promise<void>
}

export default function CommandPalette() {
  const close = () => useApp.getState().setPaletteOpen(false)
  const repo = useApp((s) => s.repo)
  const workspaceTabs = useApp((s) => s.workspaceTabs)
  const repos = useApp((s) => s.repos)
  const activateRepoWorkspace = useApp((s) => s.activateRepoWorkspace)
  const closeRepoWorkspace = useApp((s) => s.closeRepoWorkspace)
  const setActivityOpen = useApp((s) => s.setActivityOpen)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const setView = useApp((s) => s.setView)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const openRepo = useOpenRepo()
  const invalidate = useInvalidateRepo(repo?.path ?? null)
  const { runRemote } = useRemoteActions()

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [branchPrompt, setBranchPrompt] = useState(false)
  const [branchBusy, setBranchBusy] = useState(false)

  const cycleTheme = async () => {
    if (!settings) return
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const next = order[(order.indexOf(settings.theme) + 1) % order.length]
    try {
      const updated = await ipc.settingsSet({ ...settings, theme: next })
      setSettings(updated)
      toast('success', `主题已切换为 ${next}`)
    } catch (error) {
      errorToast(error)
    }
  }

  const commands = useMemo<Command[]>(() => {
    const items: Command[] = [
      {
        id: 'open',
        label: '打开仓库…',
        hint: '选择目录',
        icon: <FolderOpen size={15} />,
        run: async () => {
          const dir = await pickDirectory('选择 Git 仓库目录')
          if (dir) await openRepo(dir)
        }
      },
      {
        id: 'settings',
        label: '打开设置',
        icon: <SettingsIcon size={15} />,
        run: () => setSettingsOpen(true)
      },
      {
        id: 'theme',
        label: '切换主题',
        hint: settings?.theme,
        icon: settings?.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />,
        run: cycleTheme
      }
    ]

    if (repo) {
      for (const repoId of workspaceTabs) {
        if (repoId === repo.path) continue
        const workspace = repos[repoId]
        if (!workspace) continue
        items.push({
          id: `switch-repo-${repoId}`,
          label: `切换到仓库 ${workspace.name}`,
          hint: workspace.path,
          icon: <FolderGit2 size={15} />,
          run: () => activateRepoWorkspace(repoId)
        })
      }

      items.push(
        {
          id: 'changes',
          label: '查看工作区变更',
          icon: <ListChecks size={15} />,
          run: () => setView('changes')
        },
        {
          id: 'history',
          label: '查看提交历史',
          icon: <GitCommitHorizontal size={15} />,
          run: () => setView('history')
        },
        {
          id: 'refresh',
          label: '刷新当前仓库',
          hint: 'Status / History / Refs',
          icon: <RefreshCw size={15} />,
          run: () => {
            invalidate()
            toast('info', '已刷新当前仓库数据')
          }
        },
        {
          id: 'activity',
          label: '查看操作记录',
          hint: 'Git / hooks / errors',
          icon: <Activity size={15} />,
          run: () => setActivityOpen(true)
        },
        {
          id: 'commit',
          label: '聚焦提交信息',
          hint: 'Ctrl+Enter 提交',
          icon: <GitCommitHorizontal size={15} />,
          run: () => {
            setView('changes')
            window.setTimeout(() => {
              document.getElementById('commit-message')?.focus()
            }, 0)
          }
        },
        {
          id: 'conflicts',
          label: '查看冲突',
          icon: <GitMerge size={15} />,
          run: () => setView('conflicts')
        },
        {
          id: 'fetch',
          label: 'Fetch（获取远程更新）',
          icon: <RefreshCw size={15} />,
          run: () => runRemote('fetch')
        },
        {
          id: 'pull',
          label: 'Pull（拉取并合并）',
          icon: <ArrowDown size={15} />,
          run: () => runRemote('pull')
        },
        {
          id: 'push',
          label: 'Push（推送当前分支）',
          icon: <ArrowUp size={15} />,
          run: () => runRemote('push')
        },
        {
          id: 'stash',
          label: '储藏当前改动',
          icon: <Archive size={15} />,
          run: async () => {
            try {
              await ipc.stashSave(repo.path, null, true)
              invalidate()
              toast('success', '已储藏当前改动')
            } catch (error) {
              errorToast(error)
            }
          }
        },
        {
          id: 'terminal',
          label: '在终端中打开仓库',
          icon: <Terminal size={15} />,
          run: async () => {
            try {
              await ipc.openInTerminal(repo.path)
            } catch (error) {
              errorToast(error)
            }
          }
        },
        {
          id: 'branch',
          label: '新建并切换到分支…',
          hint: '输入名称',
          icon: <GitBranch size={15} />,
          run: () => setBranchPrompt(true)
        },
        {
          id: 'close-repo',
          label: '关闭当前仓库 Tab',
          hint: repo.name,
          icon: <FolderGit2 size={15} />,
          run: async () => {
            try {
              await ipc.repoClose(repo.path)
              closeRepoWorkspace(repo.path)
              toast('success', `已关闭 ${repo.name}`)
            } catch (error) {
              errorToast(error)
            }
          }
        }
      )
    }

    return items
  }, [
    repo,
    workspaceTabs,
    repos,
    activateRepoWorkspace,
    closeRepoWorkspace,
    settings,
    setSettingsOpen,
    setView,
    setActivityOpen,
    invalidate,
    toast,
    errorToast,
    runRemote
  ])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return commands
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(keyword) ||
        (command.hint ?? '').toLowerCase().includes(keyword)
    )
  }, [commands, query])

  useEffect(() => {
    setIndex(0)
  }, [query])

  const execute = async (command: Command) => {
    if (command.id === 'branch') {
      setBranchPrompt(true)
      return
    }
    close()
    await command.run()
  }

  const createBranch = async (name: string) => {
    if (!repo) return
    setBranchBusy(true)
    try {
      await ipc.branchCreate(repo.path, name, true)
      invalidate()
      toast('success', `已创建并切换到 ${name}`)
      setBranchPrompt(false)
      close()
    } catch (error) {
      errorToast(error)
    } finally {
      setBranchBusy(false)
    }
  }

  return (
    <>
      <div
        className="modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className="palette">
          <div className="palette-input">
            <Search size={16} className="text-subtle" />
            <input
              autoFocus
              value={query}
              placeholder="输入命令…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') close()
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setIndex((value) => Math.min(value + 1, Math.max(filtered.length - 1, 0)))
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setIndex((value) => Math.max(value - 1, 0))
                }
                if (event.key === 'Enter' && filtered[index]) {
                  event.preventDefault()
                  execute(filtered[index])
                }
              }}
            />
            <span className="kbd">Esc</span>
          </div>
          <div className="palette-list">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--text-subtle)]">没有匹配的命令</div>
            )}
            {filtered.map((command, itemIndex) => (
              <div
                key={command.id}
                className={`palette-item ${itemIndex === index ? 'active' : ''}`}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => execute(command)}
              >
                <span className="text-[var(--text-muted)]">{command.icon}</span>
                <span className="palette-label">{command.label}</span>
                {command.hint && <span className="kbd">{command.hint}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PromptDialog
        open={branchPrompt}
        title="新建分支"
        label="分支名称"
        placeholder="feature/my-change"
        confirmLabel="创建并切换"
        busy={branchBusy}
        onSubmit={createBranch}
        onCancel={() => setBranchPrompt(false)}
      />
    </>
  )
}
