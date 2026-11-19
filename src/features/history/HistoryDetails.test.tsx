// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LANE_COLORS, type GraphRow } from '../../lib/graph'
import { GraphCell } from './HistoryDetails'

afterEach(cleanup)

describe('GraphCell', () => {
  it('draws passing lanes with their propagated branch colors', () => {
    const row: GraphRow = {
      oid: 'current',
      lane: 0,
      color: 1,
      before: ['current', 'passing'],
      beforeColors: [1, 3],
      after: ['parent', 'passing'],
      afterColors: [1, 3],
      edges: [{ from: 0, to: 0, color: 1, merge: false }],
      laneCount: 2
    }
    const { container } = render(<GraphCell row={row} />)
    const lines = [...container.querySelectorAll('line')]
    const circle = container.querySelector('circle')

    expect(lines[0].getAttribute('stroke')).toBe(LANE_COLORS[3])
    expect(circle?.getAttribute('fill')).toBe(LANE_COLORS[1])
  })
})
