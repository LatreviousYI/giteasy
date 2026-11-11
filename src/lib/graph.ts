import type { CommitDto } from './types'

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
  after: (string | null)[]
  edges: GraphEdge[]
  laneCount: number
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

export function laneColor(oid: string): number {
  let hash = 0
  for (let i = 0; i < oid.length; i += 1) {
    hash = (hash * 31 + oid.charCodeAt(i)) >>> 0
  }
  return hash % LANE_COLORS.length
}

export function buildGraph(commits: CommitDto[]): {
  rows: GraphRow[]
  laneCount: number
} {
  const lanes: (string | null)[] = []
  const rows: GraphRow[] = []
  let laneCount = 1

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.oid)
    if (lane === -1) {
      lane = lanes.findIndex((item) => item === null)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(null)
      }
      lanes[lane] = commit.oid
    }

    const before = lanes.slice()
    const color = laneColor(commit.oid)
    const edges: GraphEdge[] = []
    const parents = commit.parents

    if (parents.length > 0) {
      const primary = parents[0]
      let primaryLane = lanes.indexOf(primary)
      if (primaryLane === -1) {
        primaryLane = lane
        lanes[lane] = primary
      } else if (primaryLane === lane) {
        lanes[lane] = primary
      } else {
        lanes[lane] = null
      }
      edges.push({ from: lane, to: primaryLane, color, merge: false })

      for (const parent of parents.slice(1)) {
        let parentLane = lanes.indexOf(parent)
        if (parentLane === -1) {
          parentLane = lanes.findIndex((item) => item === null)
          if (parentLane === -1) {
            parentLane = lanes.length
            lanes.push(null)
          }
          lanes[parentLane] = parent
        }
        edges.push({
          from: lane,
          to: parentLane,
          color: laneColor(parent),
          merge: true
        })
      }
    } else {
      lanes[lane] = null
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
    }

    laneCount = Math.max(laneCount, before.length, lanes.length, lane + 1)
    for (const edge of edges) {
      laneCount = Math.max(laneCount, edge.from + 1, edge.to + 1)
    }

    rows.push({
      oid: commit.oid,
      lane,
      color,
      before,
      after: lanes.slice(),
      edges,
      laneCount
    })
  }

  return { rows, laneCount }
}
