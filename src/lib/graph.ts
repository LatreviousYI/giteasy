import type { BranchDto, CommitDto } from './types'

export interface GraphEdge {
  from: number
  to: number
  color: number
  merge: boolean
}

export interface GraphRow {
  oid: string
  lane: number
  color: number
  before: (string | null)[]
  beforeColors: (number | null)[]
  after: (string | null)[]
  afterColors: (number | null)[]
  edges: GraphEdge[]
  laneCount: number
}

interface Lane {
  oid: string
  color: number
}

interface BranchColorEntry {
  key: string
  oid: string
  priority: number
  color: number
}

export const LANE_COLORS = [
  '#5B6CFF',
  '#1F9D6B',
  '#E0823D',
  '#C6538E',
  '#3E8ED0',
  '#9A6700',
  '#8B5CF6',
  '#0EA5A4'
]

export function branchColorIndex(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash % LANE_COLORS.length
}

function branchEntries(branches: BranchDto[]): BranchColorEntry[] {
  return branches
    .map((branch) => {
      const priority = branch.isHead ? 0 : branch.isRemote ? 2 : 1
      const key = `${branch.isRemote ? 'remote' : 'local'}:${branch.name}`
      return {
        key,
        oid: branch.oid,
        priority,
        color: branchColorIndex(key)
      }
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.key.localeCompare(right.key) ||
        left.oid.localeCompare(right.oid)
    )
}

function assignBranchColors(branches: BranchDto[]): BranchColorEntry[] {
  const used = new Set<number>()
  return branchEntries(branches).map((entry) => {
    let color = entry.color
    if (used.size < LANE_COLORS.length) {
      for (let offset = 0; offset < LANE_COLORS.length; offset += 1) {
        const candidate = (entry.color + offset) % LANE_COLORS.length
        if (!used.has(candidate)) {
          color = candidate
          break
        }
      }
    }
    used.add(color)
    return { ...entry, color }
  })
}

function fallbackColor(oid: string): number {
  return branchColorIndex(`commit:${oid}`)
}

function commitColors(commits: CommitDto[], branches: BranchDto[]): Map<string, number> {
  const colors = new Map<string, number>()

  for (const branch of assignBranchColors(branches)) {
    if (!colors.has(branch.oid)) colors.set(branch.oid, branch.color)
  }

  for (const commit of commits) {
    const color = colors.get(commit.oid) ?? fallbackColor(commit.oid)
    colors.set(commit.oid, color)

    commit.parents.forEach((parent, index) => {
      if (colors.has(parent)) return
      colors.set(parent, index === 0 ? color : fallbackColor(parent))
    })
  }

  return colors
}

function laneSnapshot(lanes: (Lane | null)[]) {
  return {
    oids: lanes.map((lane) => lane?.oid ?? null),
    colors: lanes.map((lane) => lane?.color ?? null)
  }
}

export function buildGraph(
  commits: CommitDto[],
  branches: BranchDto[] = []
): {
  rows: GraphRow[]
  laneCount: number
} {
  const colors = commitColors(commits, branches)
  const lanes: (Lane | null)[] = []
  const rows: GraphRow[] = []
  let laneCount = 1

  for (const commit of commits) {
    const color = colors.get(commit.oid) ?? fallbackColor(commit.oid)
    let lane = lanes.findIndex((item) => item?.oid === commit.oid)
    if (lane === -1) {
      lane = lanes.findIndex((item) => item === null)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(null)
      }
      lanes[lane] = { oid: commit.oid, color }
    } else {
      lanes[lane] = { oid: commit.oid, color }
    }

    const before = laneSnapshot(lanes)
    const edges: GraphEdge[] = []
    const parents = commit.parents

    if (parents.length > 0) {
      const primary = parents[0]
      let primaryLane = lanes.findIndex((item) => item?.oid === primary)
      const primaryColor = colors.get(primary) ?? color
      if (primaryLane === -1) {
        primaryLane = lane
        lanes[lane] = { oid: primary, color: primaryColor }
      } else if (primaryLane === lane) {
        lanes[lane] = { oid: primary, color: primaryColor }
      } else {
        lanes[lane] = null
      }
      edges.push({ from: lane, to: primaryLane, color, merge: false })

      for (const parent of parents.slice(1)) {
        const parentColor = colors.get(parent) ?? fallbackColor(parent)
        let parentLane = lanes.findIndex((item) => item?.oid === parent)
        if (parentLane === -1) {
          parentLane = lanes.findIndex((item) => item === null)
          if (parentLane === -1) {
            parentLane = lanes.length
            lanes.push(null)
          }
          lanes[parentLane] = { oid: parent, color: parentColor }
        }
        edges.push({
          from: lane,
          to: parentLane,
          color: parentColor,
          merge: true
        })
      }
    } else {
      lanes[lane] = null
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
    }

    const after = laneSnapshot(lanes)
    laneCount = Math.max(laneCount, before.oids.length, after.oids.length, lane + 1)
    for (const edge of edges) {
      laneCount = Math.max(laneCount, edge.from + 1, edge.to + 1)
    }

    rows.push({
      oid: commit.oid,
      lane,
      color,
      before: before.oids,
      beforeColors: before.colors,
      after: after.oids,
      afterColors: after.colors,
      edges,
      laneCount
    })
  }

  return { rows, laneCount }
}
