import { describe, expect, it, vi } from 'vitest'
import { checkoutThenPull } from './remote'

describe('checkoutThenPull', () => {
  it('pulls directly on the current branch', async () => {
    const checkout = vi.fn()
    const pull = vi.fn().mockResolvedValue(undefined)
    await checkoutThenPull(true, checkout, pull)
    expect(checkout).not.toHaveBeenCalled()
    expect(pull).toHaveBeenCalledOnce()
  })

  it('checks out a different branch before pulling', async () => {
    const calls: string[] = []
    await checkoutThenPull(
      false,
      async () => {
        calls.push('checkout')
      },
      async () => {
        calls.push('pull')
      }
    )
    expect(calls).toEqual(['checkout', 'pull'])
  })

  it('does not pull when checkout fails', async () => {
    const pull = vi.fn()
    await expect(
      checkoutThenPull(
        false,
        async () => {
          throw new Error('switch failed')
        },
        pull
      )
    ).rejects.toThrow('switch failed')
    expect(pull).not.toHaveBeenCalled()
  })
})
