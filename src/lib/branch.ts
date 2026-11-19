export interface TrackedRemoteBranch {
  remote: string
  branch: string
}

export function remoteBranchShortName(remoteName: string, branchName: string): string {
  const prefix = `${remoteName}/`
  return branchName.startsWith(prefix) ? branchName.slice(prefix.length) : branchName
}

export function resolveTrackedRemote(
  upstream: string | null,
  remoteNames: string[]
): TrackedRemoteBranch | null {
  if (!upstream) return null
  const remote = [...remoteNames]
    .sort((left, right) => right.length - left.length)
    .find((name) => name.length > 0 && upstream.startsWith(`${name}/`))
  if (!remote) return null
  const branch = upstream.slice(remote.length + 1)
  return branch ? { remote, branch } : null
}
