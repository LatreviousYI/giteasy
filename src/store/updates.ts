import { create } from 'zustand'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ipc } from '../lib/ipc'
import type { UpdateContextDto } from '../lib/types'

const LAST_CHECK_KEY = 'giteasy.updates.lastCheck'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error'

interface UpdateStore {
  status: UpdateStatus
  context: UpdateContextDto | null
  availableVersion: string | null
  notes: string | null
  publishedAt: string | null
  downloadedBytes: number
  totalBytes: number | null
  error: string | null
  pendingUpdate: Update | null
  check: (force?: boolean) => Promise<void>
  install: () => Promise<void>
  openDownloadPage: () => Promise<void>
  clearError: () => void
}

function readLastCheck() {
  try {
    return Number(window.localStorage.getItem(LAST_CHECK_KEY)) || 0
  } catch {
    return 0
  }
}

function writeLastCheck(value: number) {
  try {
    window.localStorage.setItem(LAST_CHECK_KEY, String(value))
  } catch {
    // Update checks continue even if persistence is unavailable.
  }
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

export const useUpdates = create<UpdateStore>((set, get) => ({
  status: 'idle',
  context: null,
  availableVersion: null,
  notes: null,
  publishedAt: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  pendingUpdate: null,

  check: async (force = false) => {
    const state = get()
    if (state.status === 'checking' || state.status === 'downloading' || state.status === 'installing') {
      return
    }

    set({ status: 'checking', error: null })
    try {
      const context = await ipc.updateContext()
      const recentlyChecked =
        !force && Date.now() - readLastCheck() < CHECK_INTERVAL_MS
      if (recentlyChecked) {
        set({ context, status: 'up-to-date' })
        return
      }

      set({ context })
      if (!isTauri) {
        writeLastCheck(Date.now())
        set({ status: 'up-to-date' })
        return
      }

      const pendingUpdate = await check({ timeout: 15_000 })
      writeLastCheck(Date.now())
      if (!pendingUpdate) {
        set({
          status: 'up-to-date',
          pendingUpdate: null,
          availableVersion: null,
          notes: null,
          publishedAt: null
        })
        return
      }

      await get().pendingUpdate?.close()
      set({
        status: 'available',
        pendingUpdate,
        availableVersion: pendingUpdate.version,
        notes: pendingUpdate.body ?? null,
        publishedAt: pendingUpdate.date ?? null,
        downloadedBytes: 0,
        totalBytes: null
      })
    } catch (error) {
      set({
        status: 'error',
        pendingUpdate: null,
        availableVersion: null,
        notes: null,
        publishedAt: null,
        error: errorMessage(error)
      })
    }
  },

  install: async () => {
    const { pendingUpdate, context } = get()
    if (!pendingUpdate) {
      set({ status: 'error', error: '没有可安装的更新' })
      return
    }
    if (!context?.canInstallInPlace) {
      await get().openDownloadPage()
      return
    }

    let downloadedBytes = 0
    let totalBytes: number | null = null
    set({
      status: 'downloading',
      downloadedBytes,
      totalBytes,
      error: null
    })
    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? null
          set({ totalBytes })
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength
          set({ downloadedBytes })
        } else {
          set({ status: 'installing' })
        }
      })
      set({ status: 'installing' })
      await relaunch()
    } catch (error) {
      set({
        status: 'error',
        error: errorMessage(error)
      })
    }
  },

  openDownloadPage: async () => {
    try {
      await ipc.openUpdatePage()
    } catch (error) {
      set({ status: 'error', error: errorMessage(error) })
    }
  },

  clearError: () => set({ error: null })
}))
