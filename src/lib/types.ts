export interface RepoInfo {
  path: string
  name: string
  branch: string | null
  headOid: string | null
  headShort: string | null
  detached: boolean
  bare: boolean
  remoteUrl: string | null
  state: string
}

export interface FileStatus {
  path: string
  oldPath: string | null
  index: string
  worktree: string
  staged: boolean
  unstaged: boolean
  conflicted: boolean
}

export interface StatusDto {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  headOid: string | null
  headShort: string | null
  detached: boolean
  clean: boolean
  state: string
  files: FileStatus[]
}

export interface CommitRef {
  name: string
  kind: 'head' | 'branch' | 'remote' | 'tag' | string
}

export interface CommitDto {
  oid: string
  shortOid: string
  parents: string[]
  authorName: string
  authorEmail: string
  time: number
  subject: string
  body: string
  refs: CommitRef[]
}

export interface CommitPage {
  commits: CommitDto[]
  hasMore: boolean
}

export interface FileChange {
  path: string
  oldPath: string | null
  status: string
  additions: number
  deletions: number
  binary: boolean
}

export interface CommitDetail {
  commit: CommitDto
  files: FileChange[]
}

export interface CompareDto {
  leftLabel: string
  rightLabel: string
  leftOid: string
  rightOid: string
  files: FileChange[]
}

export interface TreeEntryDto {
  path: string
  name: string
  kind: 'tree' | 'blob' | 'commit' | string
  oid: string
  size: number
}

export interface FileContentDto {
  path: string
  content: string | null
  binary: boolean
  size: number
}

export interface ReflogEntryDto {
  selector: string
  oid: string
  shortOid: string
  action: string
  time: number
}

export interface GitHubAccount {
  login: string
  name: string
  avatarUrl: string
}

export interface GitHubDeviceStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface GitHubRepo {
  id: number
  fullName: string
  name: string
  private: boolean
  cloneUrl: string
  sshUrl: string
  defaultBranch: string
  description: string | null
  updatedAt: string
}

export interface GitHubNotification {
  id: string
  unread: boolean
  reason: string
  updatedAt: string
  subject: { title: string; type: string; url: string | null }
  repository: { fullName: string }
}

export interface GitHubActor {
  login: string
  avatarUrl: string
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  state: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  user: GitHubActor
  pullRequest: unknown | null
  assignee: GitHubActor | null
}

export interface CommitResult {
  oid: string
  output: string
}

export interface DiffLine {
  kind: 'add' | 'del' | 'context'
  oldLineNo: number | null
  newLineNo: number | null
  content: string
}

export interface Hunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffDto {
  path: string
  oldPath: string | null
  status: string
  binary: boolean
  additions: number
  deletions: number
  hunks: Hunk[]
}

export interface BranchDto {
  name: string
  isRemote: boolean
  isHead: boolean
  upstream: string | null
  ahead: number
  behind: number
  oid: string
  shortOid: string
  subject: string
}

export interface TagDto {
  name: string
  oid: string
  shortOid: string
  message: string | null
  time: number | null
  annotated: boolean
}

export interface RemoteDto {
  name: string
  url: string
}

export interface StashDto {
  index: number
  message: string
  oid: string
  shortOid: string
  time: number
}

export interface BlameLine {
  lineNo: number
  oid: string
  shortOid: string
  author: string
  time: number
  content: string
}

export interface ConflictFile {
  path: string
  ours: string | null
  theirs: string | null
  base: string | null
  result: string
  binary: boolean
}

export interface SubmoduleDto {
  name: string
  path: string
  url: string
  headOid: string | null
  status: string
}

export interface WorktreeDto {
  path: string
  head: string | null
  branch: string | null
  bare: boolean
  detached: boolean
}

export interface ProgressEvent {
  phase: string
  percent: number | null
  message: string
  done: boolean
  error: string | null
}

export interface RecentRepo {
  path: string
  name: string
  lastOpened: number
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  monoFont: string
  fontSize: number
  externalEditor: string
  terminal: string
  autoFetchMinutes: number
  recent: RecentRepo[]
}

export interface Identity {
  name: string
  email: string
}

export interface LogQuery {
  rev?: string | null
  limit: number
  skip: number
  author?: string | null
  query?: string | null
  file?: string | null
}

export interface Selection {
  hunk: number
  lines: number[]
}

export interface RebaseCommit {
  oid: string
  shortOid: string
  subject: string
}

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'

export interface RebaseStep {
  action: RebaseAction
  oid: string
  message?: string | null
}

export interface AppError {
  kind: string
  code: string
  message: string
  hint?: string | null
  detail?: string | null
}

export interface SshHostProbe {
  host: string
  keys: string[]
  fingerprints: string[]
}

export interface SshPublicKey {
  path: string
  content: string
  exists: boolean
}

export interface ActivityEvent {
  id: number
  repoPath: string
  command: string
  status: 'success' | 'error' | string
  startedAt: number
  finishedAt: number
  durationMs: number
  summary: string
  output: string | null
  error: string | null
}
