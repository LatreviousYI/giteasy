import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatClockTime, formatFileSize, relativeTime } from './format'

afterEach(() => {
  vi.useRealTimers()
})

describe('format helpers', () => {
  it('formats activity clock time from milliseconds', () => {
    const timestamp = new Date(2026, 0, 2, 3, 4, 5).getTime()
    expect(formatClockTime(timestamp)).toBe('03:04:05')
  })

  it('formats file sizes at stable unit boundaries', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('formats relative time from a fixed clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'))
    const now = Math.floor(Date.now() / 1000)

    expect(relativeTime(now - 30)).toBe('刚刚')
    expect(relativeTime(now - 120)).toBe('2 分钟前')
    expect(relativeTime(now - 7200)).toBe('2 小时前')
  })
})
