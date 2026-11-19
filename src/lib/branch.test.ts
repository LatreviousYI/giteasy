import { describe, expect, it } from 'vitest'
import { remoteBranchShortName, resolveTrackedRemote } from './branch'

describe('branch helpers', () => {
  it('removes only the selected remote prefix from a branch name', () => {
    expect(remoteBranchShortName('origin', 'origin/feature/login')).toBe('feature/login')
    expect(remoteBranchShortName('origin', 'feature/login')).toBe('feature/login')
  })

  it('resolves the configured remote and remote branch from an upstream', () => {
    expect(resolveTrackedRemote('origin/feature/login', ['origin', 'upstream'])).toEqual({
      remote: 'origin',
      branch: 'feature/login'
    })
  })

  it('prefers the longest matching remote name', () => {
    expect(resolveTrackedRemote('team/origin/main', ['origin', 'team/origin'])).toEqual({
      remote: 'team/origin',
      branch: 'main'
    })
  })

  it('rejects missing and unknown upstreams', () => {
    expect(resolveTrackedRemote(null, ['origin'])).toBeNull()
    expect(resolveTrackedRemote('other/main', ['origin'])).toBeNull()
    expect(resolveTrackedRemote('origin/', ['origin'])).toBeNull()
  })
})
