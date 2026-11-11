export type View = 'changes' | 'history' | 'conflicts'

export interface RepoViewState {
  view: View
  selectedFile: string | null
  selectedFileStaged: boolean
  selectedCommit: string | null
  diffLayout: 'unified' | 'split'
  diffIgnoreWhitespace: boolean
  diffContextLines: number
  inspector: {
    file: string
    mode: 'history' | 'blame'
    lineStart?: number
    lineEnd?: number
  } | null
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
    diffIgnoreWhitespace: false,
    diffContextLines: 3,
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
    diffIgnoreWhitespace: state.diffIgnoreWhitespace,
    diffContextLines: state.diffContextLines,
    inspector: state.inspector
  }
}
