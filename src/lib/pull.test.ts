import { describe, expect, it } from 'vitest'
import { effectivePullMode, isDiverged, pullModeLabel } from './pull'

describe('pull strategy', () => {
  it('uses the saved repository strategy only for automatic pulls', () => {
    expect(effectivePullMode('auto', 'rebase')).toBe('rebase')
    expect(effectivePullMode('auto', null)).toBe('auto')
    expect(effectivePullMode('merge', 'rebase')).toBe('merge')
    expect(effectivePullMode('ff-only', 'merge')).toBe('ff-only')
  })

  it('only treats branches with commits on both sides as divergent', () => {
    expect(isDiverged({ ahead: 1, behind: 1 })).toBe(true)
    expect(isDiverged({ ahead: 1, behind: 0 })).toBe(false)
    expect(isDiverged({ ahead: 0, behind: 1 })).toBe(false)
  })

  it('provides compact labels for the pull controls', () => {
    expect(pullModeLabel('auto')).toBe('自动')
    expect(pullModeLabel('merge')).toBe('合并')
    expect(pullModeLabel('rebase')).toBe('变基')
    expect(pullModeLabel('ff-only')).toBe('仅快进')
  })
})
