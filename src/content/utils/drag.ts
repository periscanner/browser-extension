export interface WidgetPosition { left: number; top: number }

/** Pin the container at an absolute viewport position, clamped so it stays fully on-screen. */
export function applyPosition(container: HTMLElement, pos: WidgetPosition): WidgetPosition {
  const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth)
  const maxTop = Math.max(0, window.innerHeight - container.offsetHeight)
  const clamped = {
    left: Math.max(0, Math.min(pos.left, maxLeft)),
    top: Math.max(0, Math.min(pos.top, maxTop)),
  }
  container.style.bottom = 'auto'
  container.style.right = 'auto'
  container.style.left = `${clamped.left}px`
  container.style.top = `${clamped.top}px`
  return clamped
}

export function makeDraggable(
  container: HTMLElement,
  handle: HTMLElement,
  onDrop?: (pos: WidgetPosition) => void,
) {
  let isDragging = false
  let hasMoved = false
  let startX = 0
  let startY = 0
  let initialLeft = 0
  let initialTop = 0

  handle.addEventListener('pointerdown', startDrag)

  function startDrag(e: PointerEvent) {
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)

    const rect = container.getBoundingClientRect()
    applyPosition(container, { left: rect.left, top: rect.top })

    startX = e.clientX
    startY = e.clientY
    initialLeft = rect.left
    initialTop = rect.top

    isDragging = true
    hasMoved = false

    handle.addEventListener('pointermove', onPointerMove)
    handle.addEventListener('pointerup', onPointerUp)
    handle.addEventListener('pointercancel', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true

    applyPosition(container, { left: initialLeft + dx, top: initialTop + dy })
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return
    isDragging = false
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
    // Persist once per drop — never per pointermove.
    if (hasMoved) onDrop?.({ left: parseFloat(container.style.left), top: parseFloat(container.style.top) })
    setTimeout(() => { hasMoved = false }, 100)
  }

  return { wasDragging: () => hasMoved }
}