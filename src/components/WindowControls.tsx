import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useApp } from '../store/app'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export default function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    const appWindow = getCurrentWindow()
    let disposed = false
    let unlisten: (() => void) | undefined

    const syncMaximized = () => {
      appWindow
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value)
        })
        .catch(() => undefined)
    }

    syncMaximized()
    appWindow
      .onResized(syncMaximized)
      .then((dispose) => {
        if (disposed) dispose()
        else unlisten = dispose
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  if (!isTauri) return null

  const runWindowAction = (action: () => Promise<void>) => {
    action().catch((error) => useApp.getState().errorToast(error))
  }

  const appWindow = getCurrentWindow()

  return (
    <div className="window-controls" aria-label="窗口控制">
      <button
        className="window-control"
        title="最小化"
        aria-label="最小化"
        onClick={() => runWindowAction(() => appWindow.minimize())}
      >
        <Minus size={14} />
      </button>
      <button
        className="window-control"
        title={maximized ? '还原' : '最大化'}
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => runWindowAction(() => appWindow.toggleMaximize())}
      >
        {maximized ? <Copy size={13} /> : <Square size={12} />}
      </button>
      <button
        className="window-control window-control-close"
        title="关闭"
        aria-label="关闭"
        onClick={() => runWindowAction(() => appWindow.close())}
      >
        <X size={15} />
      </button>
    </div>
  )
}
