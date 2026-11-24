interface ViewportSize {
  width: number
  height: number
}

const VIEWPORT_MARGIN = 8

export function clampContextMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewport: ViewportSize
) {
  const menuHeight = Math.min(height, Math.max(1, viewport.height - VIEWPORT_MARGIN * 2))
  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN)
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - menuHeight - VIEWPORT_MARGIN)
  const left = Math.max(VIEWPORT_MARGIN, Math.min(x, maxX))
  const preferredTop = y + menuHeight > viewport.height - VIEWPORT_MARGIN ? y - menuHeight : y
  const top = Math.max(VIEWPORT_MARGIN, Math.min(preferredTop, maxY))
  return { x: left, y: top }
}
