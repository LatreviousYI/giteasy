import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFLICT_VERSIONS_PERCENT,
  MAX_CONFLICT_VERSIONS_PERCENT,
  MIN_CONFLICT_VERSIONS_PERCENT,
  clampConflictVersionsPercent,
  readConflictVersionsPercent,
  resizeConflictVersionsPercent
} from './conflictPaneSize'

describe('conflict pane sizing', () => {
  it('clamps invalid and extreme percentages', () => {
    expect(clampConflictVersionsPercent(Number.NaN)).toBe(DEFAULT_CONFLICT_VERSIONS_PERCENT)
    expect(clampConflictVersionsPercent(2)).toBe(MIN_CONFLICT_VERSIONS_PERCENT)
    expect(clampConflictVersionsPercent(99)).toBe(MAX_CONFLICT_VERSIONS_PERCENT)
  })

  it('falls back safely for missing or malformed storage values', () => {
    expect(readConflictVersionsPercent(null)).toBe(DEFAULT_CONFLICT_VERSIONS_PERCENT)
    expect(readConflictVersionsPercent('broken')).toBe(DEFAULT_CONFLICT_VERSIONS_PERCENT)
    expect(readConflictVersionsPercent('42')).toBe(42)
  })

  it('converts pointer movement using the container height', () => {
    expect(resizeConflictVersionsPercent(30, 120, 600)).toBe(50)
    expect(resizeConflictVersionsPercent(30, 0, 0)).toBe(30)
    expect(resizeConflictVersionsPercent(70, 200, 400)).toBe(MAX_CONFLICT_VERSIONS_PERCENT)
  })
})
