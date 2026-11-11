export type View = 'changes' | 'history' | 'conflicts'

export interface RepoViewState {
  view: View
  selectedFile: string | null
  selectedFileStaged: boolean
  selectedCommit: string | null
  diffLayout: 'unified' | 'split'
  inspector: { file: string; mode: 'history' | 'blame' } | null
}

export interface PersistedWorkspace {
  tabs: string[]
  activeRepoId: string | null
  views: Record<string, RepoViewState>
}

export function createRepoViewState(): RepoViewState {
  return {
    view: 'changes',
    selectedFile: null,
    selectedFileStaged: false,
    selectedCommit: null,
    diffLayout: 'split',
    inspector: null
  }
}

export function snapshotRepoViewState(state: RepoViewState): RepoViewState {
  return {
    view: state.view,
    selectedFile: state.selectedFile,
    selectedFileStaged: state.selectedFileStaged,
    selectedCommit: state.selectedCommit,
    diffLayout: state.diffLayout,
    inspector: state.inspector
  }
}
