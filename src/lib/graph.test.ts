import { describe, expect, it } from 'vitest'
import type { BranchDto, CommitDto } from './types'
import { branchColorIndex, buildGraph } from './graph'

function commit(oid: string, parents: string[] = []): CommitDto {
  return {
    oid,
    shortOid: oid.slice(0, 7),
    parents,
    authorName: 'Test',
    authorEmail: 'test@example.com',
    time: 1,
    subject: oid,
    body: '',
    refs: []
  }
}

function branch(
  name: string,
  oid: string,
  options: { head?: boolean; remote?: boolean } = {}
): BranchDto {
  return {
    name,
    oid,
    isHead: options.head ?? false,
    isRemote: options.remote ?? false,
    upstream: null,
    ahead: 0,
    behind: 0,
    shortOid: oid.slice(0, 7),
    subject: name
  }
}

function rowColorMap(commits: CommitDto[], branches: BranchDto[]) {
  return new Map(buildGraph(commits, branches).rows.map((row) => [row.oid, row.color]))
}

describe('buildGraph branch colors', () => {
  it('keeps a linear first-parent branch on one color', () => {
    const commits = [commit('c3', ['c2']), commit('c2', ['c1']), commit('c1')]
    const rows = buildGraph(commits, [branch('main', 'c3', { head: true })]).rows
    expect(new Set(rows.map((row) => row.color)).size).toBe(1)
  })

  it('prioritizes the current branch over local and remote refs', () => {
    const commits = [commit('c3')]
    const branches = [
      branch('origin/main', 'c3', { remote: true }),
      branch('feature', 'c3'),
      branch('main', 'c3', { head: true })
    ]
    expect(buildGraph(commits, branches).rows[0].color).toBe(branchColorIndex('local:main'))
  })

  it('prioritizes a local branch over a remote branch on the same commit', () => {
    const commits = [commit('c3')]
    const branches = [branch('origin/topic', 'c3', { remote: true }), branch('topic', 'c3')]
    expect(buildGraph(commits, branches).rows[0].color).toBe(branchColorIndex('local:topic'))
  })

  it('resolves branch color collisions with the next free palette color', () => {
    const byColor = new Map<number, string>()
    let pair: [string, string] | null = null
    for (let index = 0; index < 500 && !pair; index += 1) {
      const name = `branch-${index}`
      const color = branchColorIndex(`local:${name}`)
      const previous = byColor.get(color)
      if (previous) pair = [previous, name]
      else byColor.set(color, name)
    }
    expect(pair).not.toBeNull()

    const names = pair!.sort()
    const branches = names.map((name, index) => branch(name, `c${index}`))
    const colors = rowColorMap([commit('c0'), commit('c1')], branches)
    expect(colors.get('c0')).not.toBe(colors.get('c1'))
  })

  it('reuses palette colors after eight unique branches', () => {
    const branches = Array.from({ length: 9 }, (_, index) => branch(`branch-${index}`, `c${index}`))
    const commits = branches.map((item) => commit(item.oid))
    const colorMap = rowColorMap(commits, branches)
    const colors = branches.map((item) => colorMap.get(item.oid)!)
    expect(new Set(colors.slice(0, 8)).size).toBe(8)
    expect(colors.slice(0, 8)).toContain(colors[8])
  })

  it('colors merge parents from their own branch', () => {
    const commits = [
      commit('m3', ['m2', 'f4']),
      commit('f4', ['m2']),
      commit('m2', ['m1']),
      commit('m1')
    ]
    const branches = [branch('main', 'm3', { head: true }), branch('feature', 'f4')]
    const rows = buildGraph(commits, branches).rows
    const merge = rows[0].edges.find((edge) => edge.merge)
    const feature = rows.find((row) => row.oid === 'f4')
    expect(merge?.color).toBe(feature?.color)
  })

  it('uses a stable fallback for a deleted merge parent branch', () => {
    const commits = [
      commit('m3', ['m2', 'f4']),
      commit('f4', ['m2']),
      commit('m2', ['m1']),
      commit('m1')
    ]
    const branches = [branch('main', 'm3', { head: true })]
    const rows = buildGraph(commits, branches).rows
    const merge = rows[0].edges.find((edge) => edge.merge)
    const feature = rows.find((row) => row.oid === 'f4')
    expect(merge?.color).toBe(feature?.color)
  })

  it('uses a stable fallback when no branch owns the history', () => {
    const commits = [commit('c2', ['c1']), commit('c1')]
    const first = buildGraph(commits).rows
    const second = buildGraph(commits).rows
    expect(first.map((row) => row.color)).toEqual(second.map((row) => row.color))
  })

  it('keeps a passing lane color until that commit is rendered', () => {
    const commits = [
      commit('m4', ['m2', 'f3']),
      commit('m2', ['m1']),
      commit('f3', ['m1']),
      commit('m1')
    ]
    const branches = [branch('main', 'm4', { head: true }), branch('feature', 'f3')]
    const rows = buildGraph(commits, branches).rows
    const main = rows.find((row) => row.oid === 'm2')!
    const feature = rows.find((row) => row.oid === 'f3')!
    const featureLane = main.before.indexOf('f3')
    expect(featureLane).toBeGreaterThanOrEqual(0)
    expect(main.beforeColors[featureLane]).toBe(feature.color)
  })
})
