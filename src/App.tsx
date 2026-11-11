import { lazy, Suspense, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useApp } from './store/app'
import { useSettings, useStatus } from './lib/queries'
import { ipc } from './lib/ipc'
import { useOpenRepo } from './lib/actions'
import { loadPersistedWorkspace, savePersistedWorkspace } from './lib/workspace'
import { createRepoViewState } from './store/repoState'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import ToastHost from './components/ToastHost'
import Welcome from './features/welcome/Welcome'
import ChangesView from './features/changes/ChangesView'
import HistoryView from './features/history/HistoryView'
import ConflictsView from './features/conflicts/ConflictsView'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const SettingsDialog = lazy(() => import('./features/settings/SettingsDialog'))
const CommandPalette = lazy(() => import('./features/palette/CommandPalette'))
const FileInspector = lazy(() => import('./features/inspector/FileInspector'))
const SshTrustDialog = lazy(() => import('./components/SshTrustDialog'))
const ActivityPanel = lazy(() => import('./features/activity/ActivityPanel'))
const GitHubPanel = lazy(() => import('./features/github/GitHubPanel'))
const PatchDialog = lazy(() => import('./features/patch/PatchDialog'))
const LfsPanel = lazy(() => import('./features/lfs/LfsPanel'))
const ToolsPanel = lazy(() => import('./features/tools/ToolsPanel'))
const BisectDialog = lazy(() => import('./features/bisect/BisectDialog'))
const RepositoryManagerDialog = lazy(
  () => import('./features/repo/RepositoryManagerDialog')
)

export default function App() {
  const repo = useApp((s) => s.repo)
  const view = useApp((s) => s.view)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const activityOpen = useApp((s) => s.activityOpen)
  const githubOpen = useApp((s) => s.githubOpen)
  const patchOpen = useApp((s) => s.patchOpen)
  const lfsOpen = useApp((s) => s.lfsOpen)
  const toolsOpen = useApp((s) => s.toolsOpen)
  const bisectOpen = useApp((s) => s.bisectOpen)
  const repoManagerOpen = useApp((s) => s.repoManagerOpen)
  const paletteOpen = useApp((s) => s.paletteOpen)
  const setPaletteOpen = useApp((s) => s.setPaletteOpen)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const setView = useApp((s) => s.setView)
  const queryClient = useQueryClient()
  const openRepo = useOpenRepo()

  const settingsQuery = useSettings()
  const { data: status } = useStatus(repo?.path ?? null)
  const setRepo = useApp((s) => s.setRepo)

  useEffect(() => {
    if (!isTauri) return
    let cancelled = false
    const workspace = loadPersistedWorkspace()
    if (!workspace || workspace.tabs.length === 0) return

    const restore = async () => {
      const opened: string[] = []
      let firstError: unknown = null
      for (const repoId of workspace.tabs) {
        try {
          const info = await ipc.repoOpen(repoId)
          if (cancelled) return
          useApp.getState().openRepoWorkspace(info)
          useApp
            .getState()
            .setRepoViewState(
              info.path,
              workspace.views[repoId] ?? createRepoViewState()
            )
          opened.push(info.path)
        } catch (error) {
          firstError ??= error
        }
      }
      if (cancelled) return
      if (opened.length === 0) {
        if (firstError) useApp.getState().errorToast(firstError)
        return
      }
      const activeRepoId =
        workspace.activeRepoId && opened.includes(workspace.activeRepoId)
          ? workspace.activeRepoId
          : opened[0]
      useApp.getState().activateRepoWorkspace(activeRepoId)
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = useApp.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        savePersistedWorkspace(useApp.getState().persistedWorkspace())
      }, 250)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (isTauri || !import.meta.env.DEV) return
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get('view')
    if (viewParam === 'history' || viewParam === 'changes' || viewParam === 'conflicts') {
      setView(viewParam)
    }
    if (!useApp.getState().repo) {
      import('./lib/mock').then(({ mockRepoInfo }) => setRepo(mockRepoInfo))
    }
  }, [setRepo, setView])

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data)
  }, [settingsQuery.data, setSettings])

  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings?.theme])

  useEffect(() => {
    if (!settings) return
    document.documentElement.style.setProperty('--code-size', `${settings.fontSize}px`)
    document.documentElement.style.setProperty(
      '--font-mono',
      `"${settings.monoFont}", "JetBrains Mono", monospace`
    )
  }, [settings?.fontSize, settings?.monoFont])

  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | undefined
    listen('repo://changed', (event) => {
      const payload = event.payload as { repoPath?: string }
      if (!repo?.path || payload.repoPath !== repo.path) return
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
        queryClient.invalidateQueries({ queryKey: [key, repo.path] })
      }
    })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => undefined)
    return () => unlisten?.()
  }, [repo?.path, queryClient])

  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | undefined
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'drop' && event.payload.paths[0]) {
          openRepo(event.payload.paths[0])
        }
      })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => undefined)
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      } else if (key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      } else if (key === '1') {
        event.preventDefault()
        setView('changes')
      } else if (key === '2') {
        event.preventDefault()
        setView('history')
      } else if (key === '3') {
        event.preventDefault()
        setView('conflicts')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setPaletteOpen, setSettingsOpen, setView])

  const autoFetch = settings?.autoFetchMinutes ?? 0
  useEffect(() => {
    if (!repo || !autoFetch || autoFetch <= 0) return
    const timer = window.setInterval(() => {
      ipc
        .fetch(repo.path, null, () => undefined)
        .then(() => {
          for (const key of ['status', 'log', 'branches']) {
            queryClient.invalidateQueries({ queryKey: [key, repo.path] })
          }
        })
        .catch(() => undefined)
    }, autoFetch * 60_000)
    return () => window.clearInterval(timer)
  }, [repo?.path, autoFetch, queryClient])

  return (
    <div className="app-shell">
      <TopBar status={status} />
      <div className="workspace">
        {repo ? (
          <>
            <Sidebar />
            <main className="main">
              {view === 'changes' && <ChangesView />}
              {view === 'history' && <HistoryView />}
              {view === 'conflicts' && <ConflictsView />}
            </main>
          </>
        ) : (
          <Welcome />
        )}
      </div>
      <StatusBar status={status} />
      <ToastHost />
      <Suspense fallback={null}>
        {settingsOpen && <SettingsDialog />}
        {activityOpen && repo && <ActivityPanel />}
        {githubOpen && <GitHubPanel />}
        {patchOpen && repo && <PatchDialog />}
        {lfsOpen && repo && <LfsPanel />}
        {toolsOpen && <ToolsPanel />}
        {bisectOpen && repo && <BisectDialog />}
        {repoManagerOpen && <RepositoryManagerDialog />}
        {paletteOpen && <CommandPalette />}
        {repo && <FileInspector />}
        <SshTrustDialog />
      </Suspense>
    </div>
  )
}
