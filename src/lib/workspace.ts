import type { PersistedWorkspace, RepoViewState } from '../store/repoState'

const WORKSPACE_KEY = 'giteasy.workspace.v1'

export function loadPersistedWorkspace(): PersistedWorkspace | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>
    if (!Array.isArray(parsed.tabs)) return null
    const tabs = parsed.tabs.filter(
      (repoId): repoId is string => typeof repoId === 'string'
    )
    const views: Record<string, RepoViewState> = {}
    for (const repoId of tabs) {
      const saved = parsed.views?.[repoId]
      views[repoId] = {
        view: saved?.view === 'history' || saved?.view === 'conflicts' ? saved.view : 'changes',
        selectedFile: typeof saved?.selectedFile === 'string' ? saved.selectedFile : null,
        selectedFileStaged: Boolean(saved?.selectedFileStaged),
        selectedCommit: typeof saved?.selectedCommit === 'string' ? saved.selectedCommit : null,
        diffIgnoreWhitespace: Boolean(saved?.diffIgnoreWhitespace),
        diffContextLines:
          typeof saved?.diffContextLines === 'number' ? saved.diffContextLines : 3,
        pullStrategy:
          saved?.pullStrategy === 'merge' || saved?.pullStrategy === 'rebase'
            ? saved.pullStrategy
            : null,
        inspector:
          saved?.inspector &&
          typeof saved.inspector.file === 'string' &&
          (saved.inspector.mode === 'history' || saved.inspector.mode === 'blame')
            ? saved.inspector
            : null
      }
    }
    return {
      tabs,
      activeRepoId:
        typeof parsed.activeRepoId === 'string' ? parsed.activeRepoId : null,
      views
    }
  } catch {
    return null
  }
}

export function savePersistedWorkspace(workspace: PersistedWorkspace) {
  try {
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace))
  } catch {
    // Persistence is best-effort; storage failure must not affect Git operations.
  }
}

export function repoSidebarWidthKey(repoId: string) {
  return `giteasy.sidebarWidth.${encodeURIComponent(repoId)}`
}
