import { create } from 'zustand'
import type { AppError, ProgressEvent, RepoInfo, Settings } from '../lib/types'
import {
  createRepoViewState,
  snapshotRepoViewState,
  type PersistedWorkspace,
  type RepoViewState,
  type View
} from './repoState'

export type { View } from './repoState'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info' | 'warn'
  title: string
  message?: string
  hint?: string | null
  detail?: string | null
}

export interface SshPrompt {
  repoPath: string
  remote: string
  host: string
  keys: string[]
  fingerprints: string[]
  retry: () => void
}

interface AppStore {
  repo: RepoInfo | null
  repos: Record<string, RepoInfo>
  repoStates: Record<string, RepoViewState>
  workspaceTabs: string[]
  activeRepoId: string | null
  setRepo: (repo: RepoInfo | null) => void
  openRepoWorkspace: (repo: RepoInfo) => void
  activateRepoWorkspace: (repoId: string) => void
  closeRepoWorkspace: (repoId: string) => void
  reorderRepoWorkspace: (from: number, to: number) => void
  setRepoViewState: (repoId: string, viewState: RepoViewState) => void
  persistedWorkspace: () => PersistedWorkspace
  view: View
  setView: (view: View) => void
  selectedFile: string | null
  selectedFileStaged: boolean
  selectFile: (file: string | null, staged?: boolean) => void
  selectedCommit: string | null
  selectCommit: (oid: string | null) => void
  diffLayout: 'unified' | 'split'
  setDiffLayout: (layout: 'unified' | 'split') => void
  diffIgnoreWhitespace: boolean
  setDiffIgnoreWhitespace: (value: boolean) => void
  diffContextLines: number
  setDiffContextLines: (value: number) => void
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  activityOpen: boolean
  setActivityOpen: (open: boolean) => void
  githubOpen: boolean
  setGithubOpen: (open: boolean) => void
  patchOpen: boolean
  setPatchOpen: (open: boolean) => void
  lfsOpen: boolean
  setLfsOpen: (open: boolean) => void
  toolsOpen: boolean
  setToolsOpen: (open: boolean) => void
  bisectOpen: boolean
  setBisectOpen: (open: boolean) => void
  repoManagerOpen: boolean
  setRepoManagerOpen: (open: boolean) => void
  settings: Settings | null
  setSettings: (settings: Settings | null) => void
  progress: ProgressEvent | null
  setProgress: (progress: ProgressEvent | null) => void
  inspector: {
    file: string
    mode: 'history' | 'blame'
    lineStart?: number
    lineEnd?: number
  } | null
  openInspector: (
    file: string,
    mode: 'history' | 'blame',
    range?: { lineStart: number; lineEnd: number }
  ) => void
  closeInspector: () => void
  sshPrompt: SshPrompt | null
  setSshPrompt: (prompt: SshPrompt | null) => void
  toasts: Toast[]
  toast: (kind: Toast['kind'], title: string, options?: Partial<Toast>) => void
  errorToast: (error: unknown) => void
  dismissToast: (id: string) => void
}

function activeRepoPatch(
  state: AppStore,
  patch: Partial<RepoViewState>
): Partial<AppStore> {
  if (!state.repo) return patch
  const current = state.repoStates[state.repo.path] ?? createRepoViewState()
  return {
    ...patch,
    repoStates: {
      ...state.repoStates,
      [state.repo.path]: { ...current, ...patch }
    }
  }
}

function normalizeError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = error as Partial<AppError>
    return {
      kind: candidate.kind ?? 'unknown',
      code: candidate.code ?? 'E_UNKNOWN',
      message: String(candidate.message ?? '未知错误'),
      hint: candidate.hint,
      detail: candidate.detail
    }
  }
  return { kind: 'unknown', code: 'E_UNKNOWN', message: String(error) }
}

export const useApp = create<AppStore>((set, get) => ({
  repo: null,
  repos: {},
  repoStates: {},
  workspaceTabs: [],
  activeRepoId: null,
  setRepo: (repo) => {
    if (repo) {
      get().openRepoWorkspace(repo)
      return
    }
    const activeRepoId = get().activeRepoId
    if (activeRepoId) get().closeRepoWorkspace(activeRepoId)
  },
  openRepoWorkspace: (repo) =>
    set((state) => {
      const repoStates = { ...state.repoStates }
      if (state.repo) {
        repoStates[state.repo.path] = snapshotRepoViewState(state)
      }
      const restored = repoStates[repo.path] ?? createRepoViewState()
      repoStates[repo.path] = restored
      const workspaceTabs = state.workspaceTabs.includes(repo.path)
        ? state.workspaceTabs
        : [...state.workspaceTabs, repo.path]
      return {
        repo,
        activeRepoId: repo.path,
        repos: { ...state.repos, [repo.path]: repo },
        repoStates,
        workspaceTabs,
        ...restored
      }
    }),
  activateRepoWorkspace: (repoId) =>
    set((state) => {
      const repo = state.repos[repoId]
      if (!repo) return state
      const repoStates = { ...state.repoStates }
      if (state.repo) {
        repoStates[state.repo.path] = snapshotRepoViewState(state)
      }
      const restored = repoStates[repoId] ?? createRepoViewState()
      repoStates[repoId] = restored
      return {
        repo,
        activeRepoId: repoId,
        repoStates,
        ...restored
      }
    }),
  closeRepoWorkspace: (repoId) =>
    set((state) => {
      const closingIndex = state.workspaceTabs.indexOf(repoId)
      if (closingIndex === -1) return state
      const workspaceTabs = state.workspaceTabs.filter((id) => id !== repoId)
      const repos = { ...state.repos }
      delete repos[repoId]
      const repoStates = { ...state.repoStates }
      if (state.repo) {
        repoStates[state.repo.path] = snapshotRepoViewState(state)
      }
      delete repoStates[repoId]

      if (state.activeRepoId !== repoId) {
        return { workspaceTabs, repos, repoStates }
      }

      const nextRepoId =
        workspaceTabs[Math.max(0, closingIndex - 1)] ?? workspaceTabs[0] ?? null
      if (!nextRepoId) {
        return {
          repo: null,
          activeRepoId: null,
          workspaceTabs,
          repos,
          repoStates,
          ...createRepoViewState()
        }
      }
      const restored = repoStates[nextRepoId] ?? createRepoViewState()
      repoStates[nextRepoId] = restored
      return {
        repo: repos[nextRepoId],
        activeRepoId: nextRepoId,
        workspaceTabs,
        repos,
        repoStates,
        ...restored
      }
    }),
  reorderRepoWorkspace: (from, to) =>
    set((state) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.workspaceTabs.length ||
        to >= state.workspaceTabs.length
      ) {
        return state
      }
      const workspaceTabs = [...state.workspaceTabs]
      const [moved] = workspaceTabs.splice(from, 1)
      workspaceTabs.splice(to, 0, moved)
      return { workspaceTabs }
    }),
  setRepoViewState: (repoId, viewState) =>
    set((state) => {
      const repoStates = { ...state.repoStates, [repoId]: viewState }
      if (state.activeRepoId !== repoId) return { repoStates }
      return {
        repoStates,
        ...viewState
      }
    }),
  persistedWorkspace: () => {
    const state = get()
    const views = Object.fromEntries(
      state.workspaceTabs.map((repoId) => [
        repoId,
        state.repoStates[repoId] ?? createRepoViewState()
      ])
    )
    return {
      tabs: state.workspaceTabs,
      activeRepoId: state.activeRepoId,
      views
    }
  },
  view: 'changes',
  setView: (view) => set((state) => activeRepoPatch(state, { view })),
  selectedFile: null,
  selectedFileStaged: false,
  selectFile: (file, staged = false) =>
    set((state) =>
      activeRepoPatch(state, { selectedFile: file, selectedFileStaged: staged })
    ),
  selectedCommit: null,
  selectCommit: (oid) =>
    set((state) => activeRepoPatch(state, { selectedCommit: oid })),
  diffLayout: 'split',
  setDiffLayout: (diffLayout) =>
    set((state) => activeRepoPatch(state, { diffLayout })),
  diffIgnoreWhitespace: false,
  setDiffIgnoreWhitespace: (diffIgnoreWhitespace) =>
    set((state) => activeRepoPatch(state, { diffIgnoreWhitespace })),
  diffContextLines: 3,
  setDiffContextLines: (diffContextLines) =>
    set((state) => activeRepoPatch(state, { diffContextLines })),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  activityOpen: false,
  setActivityOpen: (activityOpen) => set({ activityOpen }),
  githubOpen: false,
  setGithubOpen: (githubOpen) => set({ githubOpen }),
  patchOpen: false,
  setPatchOpen: (patchOpen) => set({ patchOpen }),
  lfsOpen: false,
  setLfsOpen: (lfsOpen) => set({ lfsOpen }),
  toolsOpen: false,
  setToolsOpen: (toolsOpen) => set({ toolsOpen }),
  bisectOpen: false,
  setBisectOpen: (bisectOpen) => set({ bisectOpen }),
  repoManagerOpen: false,
  setRepoManagerOpen: (repoManagerOpen) => set({ repoManagerOpen }),
  settings: null,
  setSettings: (settings) => set({ settings }),
  progress: null,
  setProgress: (progress) => set({ progress }),
  inspector: null,
  openInspector: (file, mode, range) =>
    set((state) =>
      activeRepoPatch(state, {
        inspector: {
          file,
          mode,
          lineStart: range?.lineStart,
          lineEnd: range?.lineEnd
        }
      })
    ),
  closeInspector: () =>
    set((state) => activeRepoPatch(state, { inspector: null })),
  sshPrompt: null,
  setSshPrompt: (sshPrompt) => set({ sshPrompt }),
  toasts: [],
  toast: (kind, title, options) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const toast: Toast = { id, kind, title, ...options }
    set({ toasts: [...get().toasts, toast] })
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, 10000)
  },
  errorToast: (error) => {
    const parsed = normalizeError(error)
    get().toast('error', parsed.message, {
      hint: parsed.hint,
      detail: parsed.detail,
      message: parsed.code
    })
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
