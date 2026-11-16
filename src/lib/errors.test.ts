import { describe, expect, it } from 'vitest'
import { normalizeError } from './errors'

describe('normalizeError', () => {
  it('keeps structured application errors', () => {
    expect(
      normalizeError({
        kind: 'auth',
        code: 'E_AUTH',
        message: '认证失败',
        hint: '检查凭据',
        detail: 'fatal'
      })
    ).toEqual({
      kind: 'auth',
      code: 'E_AUTH',
      message: '认证失败',
      hint: '检查凭据',
      detail: 'fatal'
    })
  })

  it('normalizes native errors and strings', () => {
    expect(normalizeError(new Error('网络错误'))).toEqual({
      kind: 'unknown',
      code: 'E_UNKNOWN',
      message: '网络错误',
      hint: null,
      detail: null
    })
    expect(normalizeError('请求失败')).toEqual({
      kind: 'unknown',
      code: 'E_UNKNOWN',
      message: '请求失败'
    })
  })

  it('uses a stable fallback for unknown values', () => {
    expect(normalizeError(null).message).toBe('未知错误')
    expect(normalizeError({ message: '   ' }).message).toBe('未知错误')
  })
})
