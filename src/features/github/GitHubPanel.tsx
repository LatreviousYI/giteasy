import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CircleDot,
  GitPullRequest,
  Github,
  KeyRound,
  LogOut,
  RefreshCw,
  Search
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useBranches } from '../../lib/queries'
import { pickDirectory, useOpenRepo } from '../../lib/actions'
import { useApp } from '../../store/app'
import { relativeTime } from '../../lib/format'
import type {
  GitHubDeviceStart,
  GitHubIssue,
  GitHubNotification,
  GitHubRepo
} from '../../lib/types'
import Modal from '../../components/Modal'
import { Empty, Spinner } from '../../components/Empty'

type GitHubTab = 'accounts' | 'repos' | 'notifications' | 'pulls' | 'issues'

const TABS: { id: GitHubTab; label: string; icon: ReactNode }[] = [
  { id: 'accounts', label: '账户', icon: <KeyRound size={13} /> },
  { id: 'repos', label: '仓库', icon: <Github size={13} /> },
  { id: 'notifications', label: '通知', icon: <Bell size={13} /> },
  { id: 'pulls', label: 'Pull Requests', icon: <GitPullRequest size={13} /> },
  { id: 'issues', label: 'Issues', icon: <CircleDot size={13} /> }
]

export default function GitHubPanel() {
  const repo = useApp((s) => s.repo)
  const close = () => useApp.getState().setGithubOpen(false)
  const toast = useApp((s) => s.toast)
  const errorToast = useApp((s) => s.errorToast)
  const openRepo = useOpenRepo()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<GitHubTab>('accounts')
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState(
    () => window.localStorage.getItem('giteasy.githubClientId') ?? ''
  )
  const [device, setDevice] = useState<GitHubDeviceStart | null>(null)
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')
  const [prOpen, setPrOpen] = useState(false)
  const [prForm, setPrForm] = useState({ base: 'main', head: '', title: '', body: '', draft: false })

  const accountsQuery = useQuery({
    queryKey: ['githubAccounts'],
    queryFn: () => ipc.githubAccounts()
  })
  const accounts = accountsQuery.data ?? []

  useEffect(() => {
    if (!selectedLogin && accounts[0]) setSelectedLogin(accounts[0].login)
  }, [accounts, selectedLogin])

  useEffect(() => {
    window.localStorage.setItem('giteasy.githubClientId', clientId)
  }, [clientId])

  useEffect(() => {
    if (!device) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const account = await ipc.githubDevicePoll(clientId, device.deviceCode)
        if (cancelled || !account) return
        window.clearInterval(timer)
        setDevice(null)
        setSelectedLogin(account.login)
        await queryClient.invalidateQueries({ queryKey: ['githubAccounts'] })
        toast('success', `已登录 GitHub：${account.login}`)
        setTab('repos')
      } catch (error) {
        window.clearInterval(timer)
        setDevice(null)
        errorToast(error)
      }
    }, Math.max(5, device.interval) * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [device, clientId, queryClient, toast, errorToast])

  const reposQuery = useQuery({
    queryKey: ['githubRepos', selectedLogin],
    queryFn: () => ipc.githubRepos(selectedLogin!, 1),
    enabled: !!selectedLogin && tab === 'repos'
  })
  const notificationsQuery = useQuery({
    queryKey: ['githubNotifications', selectedLogin],
    queryFn: () => ipc.githubNotifications(selectedLogin!),
    enabled: !!selectedLogin && tab === 'notifications'
  })
  const pullsQuery = useQuery({
    queryKey: ['githubPulls', repo?.path, selectedLogin, stateFilter],
    queryFn: () => ipc.githubPullRequests(repo!.path, selectedLogin!, stateFilter),
    enabled: !!repo && !!selectedLogin && tab === 'pulls'
  })
  const issuesQuery = useQuery({
    queryKey: ['githubIssues', repo?.path, selectedLogin, stateFilter],
    queryFn: () => ipc.githubIssues(repo!.path, selectedLogin!, stateFilter),
    enabled: !!repo && !!selectedLogin && tab === 'issues'
  })
  const { data: branches = [] } = useBranches(repo?.path ?? null)

  const loginToken = async () => {
    if (!token.trim()) return
    setDeviceBusy(true)
    try {
      const account = await ipc.githubLoginToken(token.trim())
      setToken('')
      setSelectedLogin(account.login)
      await queryClient.invalidateQueries({ queryKey: ['githubAccounts'] })
      toast('success', `已登录 GitHub：${account.login}`)
      setTab('repos')
    } catch (error) {
      errorToast(error)
    } finally {
      setDeviceBusy(false)
    }
  }

  const startDevice = async () => {
    if (!clientId.trim()) {
      toast('warn', '请填写 GitHub OAuth App Client ID')
      return
    }
    setDeviceBusy(true)
    try {
      setDevice(await ipc.githubDeviceStart(clientId.trim()))
    } catch (error) {
      errorToast(error)
    } finally {
      setDeviceBusy(false)
    }
  }

  const cloneRepo = async (item: GitHubRepo) => {
    const parent = await pickDirectory('选择克隆父目录')
    if (!parent) return
    const target = `${parent.replace(/\/$/, '')}/${item.name}`
    try {
      await ipc.githubClone(item.cloneUrl, target)
      await openRepo(target)
      toast('success', `已克隆 ${item.fullName}`)
      close()
    } catch (error) {
      errorToast(error)
    }
  }

  const createPull = async () => {
    if (!repo || !selectedLogin) return
    try {
      await ipc.githubCreatePull(
        repo.path,
        selectedLogin,
        prForm.base,
        prForm.head,
        prForm.title,
        prForm.body,
        prForm.draft
      )
      toast('success', 'Pull Request 已创建')
      setPrOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['githubPulls', repo.path] })
    } catch (error) {
      errorToast(error)
    }
  }

  const filterIssues = (items: GitHubIssue[]) => {
    const keyword = search.trim().toLowerCase()
    const assigneeKeyword = assignee.trim().toLowerCase()
    return items.filter((item) => {
      if (
        keyword &&
        !`${item.title} #${item.number} ${item.user.login}`
          .toLowerCase()
          .includes(keyword)
      ) {
        return false
      }
      if (
        assigneeKeyword &&
        !(item.assignee?.login ?? '').toLowerCase().includes(assigneeKeyword)
      ) {
        return false
      }
      return true
    })
  }

  return (
    <Modal
      wide
      title={
        <span className="flex items-center gap-2">
          <Github size={16} />
          GitHub
          {selectedLogin && (
            <span className="text-[11px] font-normal text-[var(--text-subtle)]">
              {selectedLogin}
            </span>
          )}
        </span>
      }
      onClose={close}
    >
      <div className="github-layout">
        <div className="github-sidebar">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="github-content">
          {tab === 'accounts' && (
            <div className="github-section">
              <div className="github-section-title">已登录账户</div>
              {accountsQuery.isLoading ? (
                <Spinner />
              ) : accounts.length === 0 ? (
                <Empty title="尚未登录 GitHub" subtitle="使用 Device Flow 或 Token 登录。" />
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.login}
                    className={`github-account ${selectedLogin === account.login ? 'active' : ''}`}
                    onClick={() => setSelectedLogin(account.login)}
                  >
                    <img src={account.avatarUrl} alt="" />
                    <span>{account.name || account.login}</span>
                    <span className="row-sub mono">{account.login}</span>
                    <span style={{ flex: 1 }} />
                    <button
                      className="icon-btn"
                      title="退出登录"
                      onClick={async (event) => {
                        event.stopPropagation()
                        try {
                          await ipc.githubLogout(account.login)
                          setSelectedLogin(null)
                          await queryClient.invalidateQueries({ queryKey: ['githubAccounts'] })
                        } catch (error) {
                          errorToast(error)
                        }
                      }}
                    >
                      <LogOut size={13} />
                    </button>
                  </div>
                ))
              )}

              <div className="github-section-title" style={{ marginTop: 18 }}>
                OAuth Device Flow
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="GitHub OAuth App Client ID"
                />
                <button className="btn" onClick={startDevice} disabled={deviceBusy}>
                  {deviceBusy ? '请求中…' : '获取授权码'}
                </button>
              </div>
              {device && (
                <div className="github-device-box">
                  <div>
                    在 GitHub 输入验证码：
                    <b className="mono github-user-code">{device.userCode}</b>
                  </div>
                  <a href={device.verificationUri} target="_blank" rel="noreferrer">
                    {device.verificationUri}
                  </a>
                  <div className="text-[11px] text-[var(--text-subtle)]">
                    已开始等待授权，完成后会自动登录。
                  </div>
                </div>
              )}

              <div className="github-section-title" style={{ marginTop: 18 }}>
                使用 Personal Access Token
              </div>
              <div className="flex gap-2">
                <input
                  className="input mono"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_… / github_pat_…"
                />
                <button
                  className="btn btn-primary"
                  onClick={loginToken}
                  disabled={deviceBusy || !token.trim()}
                >
                  登录
                </button>
              </div>
              <div className="text-[10.5px] text-[var(--text-subtle)]">
                Token 仅保存到系统 Keyring，不写入设置文件。
              </div>
            </div>
          )}

          {tab === 'repos' && (
            <div className="github-section">
              <div className="github-section-title">
                账户仓库
                <span style={{ flex: 1 }} />
                <button className="icon-btn" onClick={() => reposQuery.refetch()}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {reposQuery.isLoading ? (
                <Spinner />
              ) : (reposQuery.data ?? []).length === 0 ? (
                <Empty title="没有仓库" subtitle="检查 Token 权限或选择其他账户。" />
              ) : (
                (reposQuery.data ?? []).map((item) => (
                  <div key={item.id} className="github-list-row">
                    <Github size={14} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="github-list-title">{item.fullName}</div>
                      <div className="github-list-sub">
                        {item.private ? 'Private' : 'Public'} · {item.defaultBranch}
                        {item.description ? ` · ${item.description}` : ''}
                      </div>
                    </div>
                    <button className="btn btn-sm" onClick={() => cloneRepo(item)}>
                      克隆
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <GitHubIssueList
              loading={notificationsQuery.isLoading}
              items={notificationsQuery.data ?? []}
              kind="notification"
              onRefresh={() => notificationsQuery.refetch()}
            />
          )}

          {(tab === 'pulls' || tab === 'issues') && (
            <div className="github-section">
              <div className="github-toolbar">
                <div className="search-box">
                  <Search size={13} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索标题、编号或作者"
                  />
                </div>
                <input
                  className="input"
                  style={{ width: 150 }}
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  placeholder="按 Assignee"
                />
                <select
                  className="select"
                  style={{ width: 100 }}
                  value={stateFilter}
                  onChange={(event) =>
                    setStateFilter(event.target.value as 'open' | 'closed' | 'all')
                  }
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="all">All</option>
                </select>
                {tab === 'pulls' && (
                  <button className="btn btn-primary" onClick={() => setPrOpen(true)}>
                    新建 PR
                  </button>
                )}
              </div>
              <GitHubIssueList
                loading={tab === 'pulls' ? pullsQuery.isLoading : issuesQuery.isLoading}
                items={filterIssues(
                  tab === 'pulls'
                    ? pullsQuery.data ?? []
                    : (issuesQuery.data ?? []).filter((item) => !item.pullRequest)
                )}
                kind={tab === 'pulls' ? 'pull' : 'issue'}
                onRefresh={() =>
                  tab === 'pulls' ? pullsQuery.refetch() : issuesQuery.refetch()
                }
              />
            </div>
          )}

          {prOpen && (
            <div className="github-pr-form">
              <div className="github-section-title">创建 Pull Request</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input mono"
                  value={prForm.head}
                  onChange={(event) =>
                    setPrForm({ ...prForm, head: event.target.value })
                  }
                  placeholder="源分支"
                  list="github-branches"
                />
                <input
                  className="input mono"
                  value={prForm.base}
                  onChange={(event) =>
                    setPrForm({ ...prForm, base: event.target.value })
                  }
                  placeholder="目标分支"
                  list="github-branches"
                />
              </div>
              <input
                className="input"
                value={prForm.title}
                onChange={(event) => setPrForm({ ...prForm, title: event.target.value })}
                placeholder="标题"
              />
              <textarea
                className="textarea"
                value={prForm.body}
                onChange={(event) => setPrForm({ ...prForm, body: event.target.value })}
                placeholder="描述"
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={prForm.draft}
                  onChange={(event) =>
                    setPrForm({ ...prForm, draft: event.target.checked })
                  }
                />
                Draft Pull Request
              </label>
              <div className="flex gap-2 justify-end">
                <button className="btn" onClick={() => setPrOpen(false)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={createPull}>
                  创建 PR
                </button>
              </div>
              <datalist id="github-branches">
                {branches
                  .filter((branch) => !branch.isRemote)
                  .map((branch) => (
                    <option key={branch.name} value={branch.name} />
                  ))}
              </datalist>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function GitHubIssueList({
  loading,
  items,
  kind,
  onRefresh
}: {
  loading: boolean
  items: Array<GitHubIssue | GitHubNotification>
  kind: 'pull' | 'issue' | 'notification'
  onRefresh: () => void
}) {
  return (
    <div className="github-section">
      <div className="github-section-title">
        {kind === 'pull' ? 'Pull Requests' : kind === 'issue' ? 'Issues' : '通知'}
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={onRefresh}>
          <RefreshCw size={13} />
        </button>
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="没有数据" subtitle="当前筛选条件下没有内容。" />
      ) : (
        items.map((item) =>
          'repository' in item ? (
            <div key={item.id} className="github-list-row">
              {item.unread ? <Bell size={14} className="text-[var(--accent)]" /> : <Bell size={14} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="github-list-title">{item.subject.title}</div>
                <div className="github-list-sub">
                  {item.repository.fullName} · {item.reason}
                </div>
              </div>
              <span className="row-sub">
                {relativeTime(Math.floor(new Date(item.updatedAt).getTime() / 1000))}
              </span>
            </div>
          ) : (
            <a
              key={item.id}
              className="github-list-row"
              href={item.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              {kind === 'pull' ? <GitPullRequest size={14} /> : <CircleDot size={14} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="github-list-title">
                  #{item.number} {item.title}
                </div>
                <div className="github-list-sub">
                  {item.user.login}
                  {item.assignee ? ` · ${item.assignee.login}` : ''} · {item.state}
                </div>
              </div>
              <span className="row-sub">
                {relativeTime(Math.floor(new Date(item.updatedAt).getTime() / 1000))}
              </span>
            </a>
          )
        )
      )}
    </div>
  )
}
