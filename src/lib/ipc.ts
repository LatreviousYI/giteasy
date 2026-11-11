import { Channel, invoke as tauriInvoke } from '@tauri-apps/api/core'
import { mockInvoke } from './mock'
import type {
  ActivityEvent,
  BlameLine,
  BranchDto,
  CompareDto,
  CommitDetail,
  CommitPage,
  CommitResult,
  ConflictFile,
  DiffDto,
  FileContentDto,
  FileStatus,
  Identity,
  LogQuery,
  ProgressEvent,
  RebaseCommit,
  RebaseStep,
  RecentRepo,
  RemoteDto,
  ReflogEntryDto,
  RepoInfo,
  Selection,
  Settings,
  SshHostProbe,
  SshPublicKey,
  StashDto,
  StatusDto,
  SubmoduleDto,
  TagDto,
  TreeEntryDto,
  WorktreeDto
} from './types'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri && import.meta.env.DEV) {
    return mockInvoke<T>(command, args)
  }
  return tauriInvoke<T>(command, args as never)
}

type ProgressHandler = (event: ProgressEvent) => void

function channel(handler: ProgressHandler): Channel<ProgressEvent> {
  const ch = new Channel<ProgressEvent>()
  ch.onmessage = handler
  return ch
}

export const ipc = {
  repoOpen: (path: string) => invoke<RepoInfo>('repo_open', { path }),
  repoClose: (path: string) => invoke<void>('repo_close', { path }),
  repoInit: (path: string) => invoke<RepoInfo>('repo_init', { path }),
  repoDiscover: (root: string) => invoke<string[]>('repo_discover', { root }),
  repoRecent: () => invoke<RecentRepo[]>('repo_recent'),
  repoForget: (path: string) => invoke<void>('repo_forget', { path }),

  statusGet: (path: string) => invoke<StatusDto>('status_get', { path }),
  logQuery: (path: string, query: LogQuery) =>
    invoke<CommitPage>('log_query', { path, query }),
  fileHistory: (path: string, file: string, limit?: number) =>
    invoke<CommitPage>('file_history', { path, file, limit }),
  lineHistory: (
    path: string,
    file: string,
    start: number,
    end: number,
    limit?: number
  ) =>
    invoke<CommitPage>('line_history', { path, file, start, end, limit }),
  commitDetail: (path: string, oid: string) =>
    invoke<CommitDetail>('commit_detail', { path, oid }),
  compareRefs: (path: string, left: string, right: string) =>
    invoke<CompareDto>('compare_refs', { path, left, right }),
  diffWorkdir: (
    path: string,
    file: string,
    staged: boolean,
    ignoreWhitespace = false,
    contextLines = 3
  ) =>
    invoke<DiffDto>('diff_workdir', {
      path,
      file,
      staged,
      ignoreWhitespace,
      contextLines
    }),
  diffCommit: (
    path: string,
    oid: string,
    file: string,
    ignoreWhitespace = false,
    contextLines = 3
  ) =>
    invoke<DiffDto>('diff_commit', {
      path,
      oid,
      file,
      ignoreWhitespace,
      contextLines
    }),
  diffRange: (
    path: string,
    left: string,
    right: string,
    file: string,
    ignoreWhitespace = false,
    contextLines = 3
  ) =>
    invoke<DiffDto>('diff_range', {
      path,
      left,
      right,
      file,
      ignoreWhitespace,
      contextLines
    }),
  commitTree: (path: string, rev: string) =>
    invoke<TreeEntryDto[]>('commit_tree', { path, rev }),
  fileAtRev: (path: string, rev: string, file: string) =>
    invoke<FileContentDto>('file_at_rev', { path, rev, file }),
  reflogList: (path: string, limit = 200) =>
    invoke<ReflogEntryDto[]>('reflog_list', { path, limit }),
  blameGet: (path: string, file: string, rev?: string) =>
    invoke<BlameLine[]>('blame_get', { path, file, rev }),

  branchesList: (path: string) => invoke<BranchDto[]>('branches_list', { path }),
  tagsList: (path: string) => invoke<TagDto[]>('tags_list', { path }),
  remoteList: (path: string) => invoke<RemoteDto[]>('remote_list', { path }),
  stashList: (path: string) => invoke<StashDto[]>('stash_list', { path }),
  stashDiff: (path: string, oid: string) =>
    invoke<DiffDto[]>('stash_diff', { path, oid }),
  conflictList: (path: string) => invoke<ConflictFile[]>('conflict_list', { path }),
  submoduleList: (path: string) => invoke<SubmoduleDto[]>('submodule_list', { path }),
  worktreeList: (path: string) => invoke<WorktreeDto[]>('worktree_list', { path }),

  stagePaths: (path: string, files: string[], stage: boolean) =>
    invoke<void>('stage_paths', { path, files, stage }),
  discardPaths: (path: string, files: string[]) =>
    invoke<void>('discard_paths', { path, files }),
  applySelection: (
    path: string,
    file: string,
    mode: 'stage' | 'unstage',
    selections: Selection[]
  ) => invoke<void>('apply_selection', { path, file, mode, selections }),
  commitCreate: (
    path: string,
    message: string,
    amend: boolean,
    signoff: boolean,
    stageAll: boolean
  ) => invoke<CommitResult>('commit_create', { path, message, amend, signoff, stageAll }),

  branchCreate: (
    path: string,
    name: string,
    checkout: boolean,
    startPoint?: string | null
  ) => invoke<RepoInfo>('branch_create', { path, name, checkout, startPoint }),
  branchCheckout: (path: string, name: string) =>
    invoke<RepoInfo>('branch_checkout', { path, name }),
  commitCheckout: (path: string, oid: string) =>
    invoke<RepoInfo>('commit_checkout', { path, oid }),
  branchDelete: (path: string, name: string, force: boolean) =>
    invoke<void>('branch_delete', { path, name, force }),
  branchRename: (path: string, oldName: string, newName: string) =>
    invoke<RepoInfo>('branch_rename', { path, oldName, newName }),
  branchSetUpstream: (path: string, name: string, upstream: string | null) =>
    invoke<void>('branch_set_upstream', { path, name, upstream }),
  mergeBranch: (path: string, name: string) =>
    invoke<void>('merge_branch', { path, name }),

  tagCreate: (path: string, name: string, message?: string | null) =>
    invoke<void>('tag_create', { path, name, message }),
  tagDelete: (path: string, name: string) => invoke<void>('tag_delete', { path, name }),
  tagPush: (path: string, name: string, remote?: string | null) =>
    invoke<void>('tag_push', { path, name, remote }),
  remoteBranchDelete: (path: string, remote: string, branch: string) =>
    invoke<void>('remote_branch_delete', { path, remote, branch }),

  reset: (path: string, oid: string, mode: 'soft' | 'mixed' | 'hard') =>
    invoke<void>('reset', { path, oid, mode }),
  cherryPick: (path: string, oid: string) =>
    invoke<void>('cherry_pick', { path, oid }),
  revert: (path: string, oid: string) => invoke<void>('revert', { path, oid }),

  rebaseTodo: (path: string, base: string) =>
    invoke<RebaseCommit[]>('rebase_todo', { path, base }),
  rebaseStart: (
    path: string,
    base: string,
    steps: RebaseStep[],
    backup: boolean,
    onProgress: ProgressHandler
  ) =>
    invoke<string | null>('rebase_start', {
      path,
      base,
      steps,
      backup,
      onEvent: channel(onProgress)
    }),

  stashSave: (path: string, message?: string | null, includeUntracked?: boolean) =>
    invoke<void>('stash_save', { path, message, includeUntracked }),
  stashApply: (path: string, index: number, pop: boolean) =>
    invoke<void>('stash_apply', { path, index, pop }),
  stashDrop: (path: string, index: number) =>
    invoke<void>('stash_drop', { path, index }),

  remoteAdd: (path: string, name: string, url: string) =>
    invoke<void>('remote_add', { path, name, url }),
  remoteRemove: (path: string, name: string) =>
    invoke<void>('remote_remove', { path, name }),
  fetch: (path: string, remote: string | null, onProgress: ProgressHandler) =>
    invoke<void>('fetch', { path, remote, onEvent: channel(onProgress) }),
  pull: (
    path: string,
    remote: string | null,
    branch: string | null,
    onProgress: ProgressHandler
  ) => invoke<void>('pull', { path, remote, branch, onEvent: channel(onProgress) }),
  push: (
    path: string,
    remote: string | null,
    branch: string | null,
    remoteBranch: string | null,
    force: boolean,
    setUpstream: boolean,
    onProgress: ProgressHandler
  ) =>
    invoke<void>('push', {
      path,
      remote,
      branch,
      remoteBranch,
      force,
      setUpstream,
      onEvent: channel(onProgress)
    }),

  opAbort: (path: string, op: string) => invoke<void>('op_abort', { path, op }),
  opContinue: (path: string, op: string) =>
    invoke<void>('op_continue', { path, op }),
  conflictResolve: (path: string, file: string, content: string) =>
    invoke<void>('conflict_resolve', { path, file, content }),

  submoduleUpdate: (path: string, init: boolean) =>
    invoke<void>('submodule_update', { path, init }),
  worktreeAdd: (
    path: string,
    dir: string,
    branch: string | null,
    newBranch: boolean
  ) => invoke<void>('worktree_add', { path, dir, branch, newBranch }),
  worktreeRemove: (path: string, dir: string, force: boolean) =>
    invoke<void>('worktree_remove', { path, dir, force }),

  openInEditor: (path: string, file?: string | null) =>
    invoke<void>('open_in_editor', { path, file }),
  openInTerminal: (path: string) => invoke<void>('open_in_terminal', { path }),

  settingsGet: () => invoke<Settings>('settings_get'),
  settingsSet: (settings: Settings) =>
    invoke<Settings>('settings_set', { settings }),
  identityGet: () => invoke<Identity>('identity_get'),
  identitySet: (name: string, email: string) =>
    invoke<Identity>('identity_set', { name, email }),

  sshProbeRemote: (path: string, remote: string) =>
    invoke<SshHostProbe>('ssh_probe_remote', { path, remote }),
  sshTrustRemote: (path: string, remote: string, keys: string[]) =>
    invoke<void>('ssh_trust_remote', { path, remote, keys }),
  sshPublicKey: () => invoke<SshPublicKey>('ssh_public_key'),

  activityList: (path: string, limit = 100) =>
    invoke<ActivityEvent[]>('activity_list', { path, limit })
}

export type { FileStatus }
