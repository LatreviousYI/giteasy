import type { PullStrategy } from '../lib/types'

export type View = 'changes' | 'history' | 'conflicts'

export interface RepoViewState {
  view: View
  selectedFile: string | null
  selectedFileStaged: boolean
  selectedCommit: string | null
  diffIgnoreWhitespace: boolean
  diffContextLines: number
  pullStrategy: PullStrategy | null
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
    diffIgnoreWhitespace: false,
    diffContextLines: 3,
    pullStrategy: null,
    inspector: null
  }
}

export function snapshotRepoViewState(state: RepoViewState): RepoViewState {
  return {
    view: state.view,
    selectedFile: state.selectedFile,
    selectedFileStaged: state.selectedFileStaged,
    selectedCommit: state.selectedCommit,
    diffIgnoreWhitespace: state.diffIgnoreWhitespace,
    diffContextLines: state.diffContextLines,
    pullStrategy: state.pullStrategy,
    inspector: state.inspector
  }
}
