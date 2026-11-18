import { useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, option, [role="button"], [role="tab"], [draggable="true"]'

export function useWindowDrag(onError: (error: unknown) => void) {
  return useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (
        event.button !== 0 ||
        typeof window === 'undefined' ||
        !('__TAURI_INTERNALS__' in window)
      ) {
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
        return
      }

      getCurrentWindow()
        .startDragging()
        .catch((error) => onError(error))
    },
    [onError]
  )
}
