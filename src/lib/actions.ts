import { open } from '@tauri-apps/plugin-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { ipc } from './ipc'
import { useApp } from '../store/app'

export async function pickDirectory(title: string): Promise<string | null> {
  try {
    const result = await open({ directory: true, multiple: false, title })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

export function useOpenRepo() {
  const setRepo = useApp((s) => s.setRepo)
  const errorToast = useApp((s) => s.errorToast)
  const client = useQueryClient()
  return useCallback(
    async (path: string) => {
      try {
        const info = await ipc.repoOpen(path)
        setRepo(info)
        client.invalidateQueries({ queryKey: ['recent'] })
        client.invalidateQueries({ queryKey: ['settings'] })
        return info
      } catch (error) {
        errorToast(error)
        return null
      }
    },
    [client, errorToast, setRepo]
  )
}

export function useInitRepo() {
  const setRepo = useApp((s) => s.setRepo)
  const errorToast = useApp((s) => s.errorToast)
  const client = useQueryClient()
  return useCallback(
    async (path: string) => {
      try {
        const info = await ipc.repoInit(path)
        setRepo(info)
        client.invalidateQueries({ queryKey: ['recent'] })
        client.invalidateQueries({ queryKey: ['settings'] })
        return info
      } catch (error) {
        errorToast(error)
        return null
      }
    },
    [client, errorToast, setRepo]
  )
}
