import type { AppError } from './types'

export function normalizeError(error: unknown): AppError {
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    const message =
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : '未知错误'
    return {
      kind:
        typeof candidate.kind === 'string' && candidate.kind.trim() ? candidate.kind : 'unknown',
      code:
        typeof candidate.code === 'string' && candidate.code.trim() ? candidate.code : 'E_UNKNOWN',
      message,
      hint: typeof candidate.hint === 'string' ? candidate.hint : null,
      detail: typeof candidate.detail === 'string' ? candidate.detail : null
    }
  }

  const message = typeof error === 'string' && error.trim() ? error : '未知错误'
  return { kind: 'unknown', code: 'E_UNKNOWN', message }
}

export function isHostKeyError(error: unknown): boolean {
  const value = error as Partial<AppError> | null
  if (!value || typeof value !== 'object') return false
  if (value.code === 'E_SSH_HOSTKEY') return true
  const text = `${value.message ?? ''}\n${value.detail ?? ''}`
  return text.includes('Host key verification failed')
}

export function isHostKeyChangedError(error: unknown): boolean {
  const value = error as Partial<AppError> | null
  if (!value || typeof value !== 'object') return false
  return (
    value.code === 'E_SSH_KEY_CHANGED' ||
    `${value.message ?? ''}\n${value.detail ?? ''}`.includes('IDENTIFICATION HAS CHANGED')
  )
}
