import { describe, expect, it, vi } from 'vitest'
import { copyTextWithToast } from './clipboard'

describe('copyTextWithToast', () => {
  it('writes text and emits the requested success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const toast = vi.fn()

    await copyTextWithToast('content', '已复制', toast, writeText)

    expect(writeText).toHaveBeenCalledWith('content')
    expect(toast).toHaveBeenCalledWith('success', '已复制')
  })

  it('emits a warning when clipboard access fails', async () => {
    const toast = vi.fn()

    await copyTextWithToast(
      'content',
      '已复制',
      toast,
      vi.fn().mockRejectedValue(new Error('denied'))
    )

    expect(toast).toHaveBeenCalledWith('warn', '无法访问剪贴板')
  })
})
