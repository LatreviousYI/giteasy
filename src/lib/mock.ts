import type {
  BranchDto,
  CommitDetail,
  CommitDto,
  CommitPage,
  ConflictFile,
  DiffDto,
  FileStatus,
  Identity,
  RepoInfo,
  Settings,
  StashDto,
  StatusDto,
  TagDto,
  WorktreeDto
} from './types'

const now = Math.floor(Date.now() / 1000)
const oid = (n: number) => n.toString(16).padStart(40, '0')
const short = (n: number) => oid(n).slice(0, 7)

export const mockRepoInfo: RepoInfo = {
  path: '/tmp/giteasy-demo',
  name: 'giteasy-demo',
  branch: 'main',
  headOid: oid(12),
  headShort: short(12),
  detached: false,
  bare: false,
  remoteUrl: 'git@example.com:demo/giteasy-demo.git',
  state: 'clean'
}

const commits: CommitDto[] = [
  {
    oid: oid(12),
    shortOid: short(12),
    parents: [oid(11)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 120,
    subject: 'refactor: 收敛主题变量',
    body: '将散落的颜色收敛到 theme 配置中。',
    refs: [{ name: 'main', kind: 'head' }, { name: 'origin/main', kind: 'remote' }]
  },
  {
    oid: oid(11),
    shortOid: short(11),
    parents: [oid(10)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 3600,
    subject: 'fix: 修复日期格式化边界',
    body: '',
    refs: []
  },
  {
    oid: oid(10),
    shortOid: short(10),
    parents: [oid(9)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 7200,
    subject: 'feat: 引入主题配置',
    body: '',
    refs: []
  },
  {
    oid: oid(9),
    shortOid: short(9),
    parents: [oid(8), oid(5)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 86400,
    subject: 'merge: 合并 feature/ui',
    body: '',
    refs: [{ name: 'v0.1.0', kind: 'tag' }]
  },
  {
    oid: oid(8),
    shortOid: short(8),
    parents: [oid(7)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 90000,
    subject: 'docs: 添加使用指南',
    body: '',
    refs: []
  },
  {
    oid: oid(5),
    shortOid: short(5),
    parents: [oid(4)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 130000,
    subject: 'feat: 添加日期格式化',
    body: '',
    refs: [{ name: 'feature/ui', kind: 'branch' }]
  },
  {
    oid: oid(4),
    shortOid: short(4),
    parents: [oid(3)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 140000,
    subject: 'feat(ui): 添加卡片样式',
    body: '',
    refs: []
  },
  {
    oid: oid(7),
    shortOid: short(7),
    parents: [oid(6)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 180000,
    subject: 'feat: 新增 slugify 工具函数',
    body: '',
    refs: []
  },
  {
    oid: oid(6),
    shortOid: short(6),
    parents: [oid(3)],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 200000,
    subject: 'chore: 初始化项目骨架',
    body: '',
    refs: []
  },
  {
    oid: oid(3),
    shortOid: short(3),
    parents: [],
    authorName: 'Demo User',
    authorEmail: 'demo@example.com',
    time: now - 220000,
    subject: 'chore: 添加编辑器配置',
    body: '',
    refs: []
  }
]

const files: FileStatus[] = [
  {
    path: 'README.md',
    oldPath: null,
    index: 'unmodified',
    worktree: 'modified',
    staged: false,
    unstaged: true,
    conflicted: false
  },
  {
    path: 'docs/draft.md',
    oldPath: null,
    index: 'unmodified',
    worktree: 'untracked',
    staged: false,
    unstaged: true,
    conflicted: false
  },
  {
    path: 'src/app.ts',
    oldPath: null,
    index: 'modified',
    worktree: 'modified',
    staged: true,
    unstaged: true,
    conflicted: false
  }
]

const status: StatusDto = {
  branch: 'main',
  upstream: 'origin/main',
  ahead: 2,
  behind: 0,
  headOid: oid(12),
  headShort: short(12),
  detached: false,
  clean: false,
  state: 'clean',
  files
}

const branches: BranchDto[] = [
  {
    name: 'main',
    isRemote: false,
    isHead: true,
    upstream: 'origin/main',
    ahead: 2,
    behind: 0,
    oid: oid(12),
    shortOid: short(12),
    subject: 'refactor: 收敛主题变量'
  },
  {
    name: 'feature/ui',
    isRemote: false,
    isHead: false,
    upstream: null,
    ahead: 0,
    behind: 3,
    oid: oid(5),
    shortOid: short(5),
    subject: 'feat: 添加日期格式化'
  },
  {
    name: 'origin/main',
    isRemote: true,
    isHead: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    oid: oid(10),
    shortOid: short(10),
    subject: 'feat: 引入主题配置'
  }
]

let mockCurrentBranch = 'main'

function activateMockBranch(name: string) {
  const shortName = name.split('/').at(-1) ?? name
  let branch = branches.find((item) => !item.isRemote && item.name === name)
  if (!branch) {
    branch = branches.find(
      (item) => !item.isRemote && item.name === shortName
    )
  }
  if (!branch) {
    branch = {
      name,
      isRemote: false,
      isHead: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      oid: status.headOid ?? oid(12),
      shortOid: status.headShort ?? short(12),
      subject: 'New mock branch'
    }
    branches.push(branch)
  }
  mockCurrentBranch = branch.name
  for (const item of branches) item.isHead = !item.isRemote && item.name === branch.name
  status.branch = branch.name
  status.detached = false
  status.headOid = branch.oid
  status.headShort = branch.shortOid
  status.upstream = branch.upstream
  status.ahead = branch.ahead
  status.behind = branch.behind
  mockRepoInfo.branch = branch.name
  mockRepoInfo.detached = false
  mockRepoInfo.headOid = branch.oid
  mockRepoInfo.headShort = branch.shortOid
  return { ...mockRepoInfo }
}

function detachMockCommit(value: string) {
  mockCurrentBranch = ''
  for (const item of branches) item.isHead = false
  const detachedShort = value.slice(0, 7)
  status.branch = null
  status.detached = true
  status.headOid = value
  status.headShort = detachedShort
  status.upstream = null
  status.ahead = 0
  status.behind = 0
  mockRepoInfo.branch = null
  mockRepoInfo.detached = true
  mockRepoInfo.headOid = value
  mockRepoInfo.headShort = detachedShort
  return { ...mockRepoInfo }
}

const tags: TagDto[] = [
  {
    name: 'v0.1.0',
    oid: oid(9),
    shortOid: short(9),
    message: '首个演示版本',
    time: now - 86000,
    annotated: true
  }
]

const stashes: StashDto[] = [
  {
    index: 0,
    message: 'wip: 主题草稿',
    oid: oid(30),
    shortOid: short(30),
    time: now - 5000
  }
]

const conflicts: ConflictFile[] = [
  {
    path: 'conflict.txt',
    ours: 'line 1\nline 2 from main\nline 3\n',
    theirs: 'line 1\nline 2 from other\nline 3\n',
    base: 'line 1\nline 2\nline 3\n',
    result: 'line 1\n<<<<<<< HEAD\nline 2 from main\n=======\nline 2 from other\n>>>>>>> other\nline 3\n',
    binary: false
  }
]

const settings: Settings = {
  theme: 'light',
  monoFont: 'JetBrains Mono',
  fontSize: 13,
  externalEditor: '',
  terminal: '',
  autoFetchMinutes: 0,
  recent: [
    { path: '/tmp/giteasy-demo', name: 'giteasy-demo', lastOpened: now - 60 },
    { path: '/tmp/giteasy-conflict', name: 'giteasy-conflict', lastOpened: now - 86400 }
  ]
}

const identity: Identity = { name: 'Demo User', email: 'demo@example.com' }

function diffFor(file: string, staged = false): DiffDto {
  const readable = file.endsWith('.md')
  return {
    path: file,
    oldPath: null,
    status: 'modified',
    binary: false,
    additions: 3,
    deletions: 1,
    hunks: [
      {
        header: '@@ -1,8 +1,10 @@',
        oldStart: 1,
        oldLines: 8,
        newStart: 1,
        newLines: 10,
        lines: [
          {
            kind: 'context',
            oldLineNo: 1,
            newLineNo: 1,
            content: readable ? '# GitEasy Demo' : 'export function greet(name: string): string {'
          },
          {
            kind: 'context',
            oldLineNo: 2,
            newLineNo: 2,
            content: readable
              ? ''
              : "  return `Hello, ${name}!`"
          },
          {
            kind: 'del',
            oldLineNo: 3,
            newLineNo: null,
            content: readable ? 'A sample repository.' : '}'
          },
          {
            kind: 'add',
            oldLineNo: null,
            newLineNo: 3,
            content: readable ? 'A sample repository for the GitEasy interface.' : ''
          },
          {
            kind: 'add',
            oldLineNo: null,
            newLineNo: 4,
            content: readable
              ? ''
              : 'export function slugify(input: string): string {'
          },
          {
            kind: 'add',
            oldLineNo: null,
            newLineNo: 5,
            content: readable
              ? '> 在这里体验暂存、提交与历史浏览。'
              : "  return input.toLowerCase().replace(/\\s+/g, '-')"
          },
          {
            kind: 'add',
            oldLineNo: null,
            newLineNo: 6,
            content: readable ? '' : '}'
          },
          {
            kind: 'context',
            oldLineNo: 4,
            newLineNo: 7,
            content: ''
          },
          {
            kind: 'context',
            oldLineNo: 5,
            newLineNo: 8,
            content: readable
              ? '## 快速开始'
              : 'export function sum(values: number[]): number {'
          },
          {
            kind: 'context',
            oldLineNo: 6,
            newLineNo: 9,
            content: readable
              ? ''
              : '  return values.reduce((total, value) => total + value, 0)'
          },
          {
            kind: 'context',
            oldLineNo: 7,
            newLineNo: 10,
            content: readable ? '1. 打开仓库' : '}'
          }
        ]
      }
    ]
  }
}

const commitDetail: CommitDetail = {
  commit: commits[0],
  files: [
    { path: 'src/theme.ts', oldPath: null, status: 'added', additions: 6, deletions: 0, binary: false },
    { path: 'src/app.ts', oldPath: null, status: 'modified', additions: 8, deletions: 1, binary: false },
    { path: 'docs/guide.md', oldPath: null, status: 'modified', additions: 2, deletions: 2, binary: false }
  ]
}

export async function mockInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  const payload = args ?? {}
  switch (command) {
    case 'repo_open':
      return mockRepoInfo as T
    case 'repo_close':
      return undefined as T
    case 'activity_list':
      return [
        {
          id: 2,
          repoPath: '/tmp/giteasy-demo',
          command: 'git commit -F -',
          status: 'success',
          startedAt: now * 1000 - 3200,
          finishedAt: now * 1000 - 3000,
          durationMs: 200,
          summary: 'pre-commit hook passed',
          output: 'pre-commit hook passed\\n[main 1234567] feat: update theme',
          error: null
        },
        {
          id: 1,
          repoPath: '/tmp/giteasy-demo',
          command: 'git status --porcelain=v2',
          status: 'success',
          startedAt: now * 1000 - 900,
          finishedAt: now * 1000 - 880,
          durationMs: 20,
          summary: '3 changed files',
          output: null,
          error: null
        }
      ] as T
    case 'repo_recent':
      return settings.recent as T
    case 'repo_discover':
      return [mockRepoInfo.path, '/tmp/giteasy-conflict'] as T
    case 'repo_forget':
      return undefined as T
    case 'status_get':
      return status as T
    case 'branch_checkout':
      return activateMockBranch(String(payload.name ?? 'main')) as T
    case 'branch_create': {
      const name = String(payload.name ?? 'feature/mock')
      const branch = activateMockBranch(name)
      if (payload.checkout === false) {
        return { ...mockRepoInfo, branch: mockCurrentBranch } as T
      }
      return branch as T
    }
    case 'branch_rename': {
      const oldName = String(payload.oldName ?? '')
      const newName = String(payload.newName ?? '')
      const branch = branches.find((item) => !item.isRemote && item.name === oldName)
      if (branch) branch.name = newName
      return activateMockBranch(newName) as T
    }
    case 'commit_checkout':
      return detachMockCommit(String(payload.oid ?? oid(12))) as T
    case 'branches_list':
      return branches as T
    case 'tags_list':
      return tags as T
    case 'remote_list':
      return [{ name: 'origin', url: 'git@example.com:demo/giteasy-demo.git' }] as T
    case 'stash_list':
      return stashes as T
    case 'stash_diff':
      return [diffFor('src/theme.ts')] as T
    case 'conflict_list':
      return conflicts as T
    case 'submodule_list':
      return [] as T
    case 'worktree_list':
      return [
        { path: '/tmp/giteasy-demo', head: oid(12), branch: 'main', bare: false, detached: false }
      ] as unknown as T
    case 'log_query': {
      const query = (payload.query ?? {}) as { limit?: number; skip?: number; query?: string }
      const keyword = (query.query ?? '').toLowerCase()
      const filtered = keyword
        ? commits.filter((commit) => commit.subject.toLowerCase().includes(keyword))
        : commits
      const limit = query.limit ?? 300
      const skip = query.skip ?? 0
      return {
        commits: filtered.slice(skip, skip + limit),
        hasMore: filtered.length > skip + limit
      } as CommitPage as T
    }
    case 'commit_detail':
      return commitDetail as T
    case 'compare_refs':
      return {
        leftLabel: String(payload.left ?? 'main'),
        rightLabel: String(payload.right ?? 'HEAD'),
        leftOid: oid(10),
        rightOid:
          payload.right === 'WORKTREE' ? 'WORKTREE' : oid(12),
        files: commitDetail.files
      } as T
    case 'commit_tree':
      return [
        { path: 'src', name: 'src', kind: 'tree', oid: oid(40), size: 0 },
        { path: 'src/theme.ts', name: 'theme.ts', kind: 'blob', oid: oid(41), size: 320 },
        { path: 'src/app.ts', name: 'app.ts', kind: 'blob', oid: oid(42), size: 520 },
        { path: 'docs', name: 'docs', kind: 'tree', oid: oid(43), size: 0 },
        { path: 'docs/guide.md', name: 'guide.md', kind: 'blob', oid: oid(44), size: 240 }
      ] as T
    case 'file_at_rev':
      return {
        path: String(payload.file ?? 'src/theme.ts'),
        content:
          "export const theme = {\\n  accent: '#5b6cff',\\n  surface: '#ffffff'\\n}\\n",
        binary: false,
        size: 68
      } as T
    case 'reflog_list':
      return [
        {
          selector: 'HEAD@{0}',
          oid: oid(12),
          shortOid: short(12),
          action: 'commit: refactor: 收敛主题变量',
          time: now - 120
        },
        {
          selector: 'HEAD@{1}',
          oid: oid(11),
          shortOid: short(11),
          action: 'checkout: moving from feature/ui to main',
          time: now - 3600
        },
        {
          selector: 'HEAD@{2}',
          oid: oid(10),
          shortOid: short(10),
          action: 'reset: moving to HEAD~1',
          time: now - 7200
        }
      ] as T
    case 'rebase_todo':
      return commits
        .slice(0, 4)
        .map((commit) => ({
          oid: commit.oid,
          shortOid: commit.shortOid,
          subject: commit.subject
        }))
        .reverse() as T
    case 'rebase_start':
      return undefined as T
    case 'commit_create':
      return { oid: oid(13), output: 'mock: pre-commit hook passed' } as T
    case 'tag_push':
    case 'remote_branch_delete':
    case 'remote_add':
    case 'remote_remove':
    case 'tag_create':
    case 'tag_delete':
      return undefined as T
    case 'file_history':
      return { commits: commits.slice(0, 5), hasMore: false } as CommitPage as T
    case 'blame_get':
      return [
        {
          lineNo: 1,
          oid: oid(12),
          shortOid: short(12),
          author: 'Demo User',
          time: now - 120,
          content: '# GitEasy Demo'
        },
        {
          lineNo: 2,
          oid: oid(12),
          shortOid: short(12),
          author: 'Demo User',
          time: now - 120,
          content: ''
        },
        {
          lineNo: 3,
          oid: oid(11),
          shortOid: short(11),
          author: 'Demo User',
          time: now - 3600,
          content: 'A sample repository for the GitEasy interface.'
        }
      ] as T
    case 'diff_workdir':
      return diffFor(String(payload.file ?? ''), Boolean(payload.staged)) as T
    case 'diff_commit':
      return diffFor(String(payload.file ?? '')) as T
    case 'diff_range':
      return diffFor(String(payload.file ?? '')) as T
    case 'settings_get':
      return settings as T
    case 'settings_set':
      return (payload.settings ?? settings) as T
    case 'identity_get':
      return identity as T
    case 'identity_set':
      return identity as T
    case 'ssh_probe_remote':
      return {
        host: 'gitee.com',
        keys: ['gitee.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoKeyForPreviewOnly'],
        fingerprints: ['256 SHA256:demoFingerprintForPreviewOnly gitee.com (ED25519)']
      } as T
    case 'ssh_trust_remote':
      return undefined as T
    case 'ssh_public_key':
      return {
        path: '/home/demo/.ssh/id_ed25519.pub',
        content: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoKeyForPreviewOnly demo@example.com',
        exists: true
      } as T
    default:
      return undefined as T
  }
}
