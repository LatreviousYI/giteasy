import type { AppError } from './types'

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
