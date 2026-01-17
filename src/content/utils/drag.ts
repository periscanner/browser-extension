export function makeDraggable(container: HTMLElement, handle: HTMLElement) {
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
    container.style.transform = 'none'
    container.style.bottom = 'auto'
    container.style.right = 'auto'
    container.style.left = `${rect.left}px`
    container.style.top = `${rect.top}px`

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

    let newLeft = initialLeft + dx
    let newTop = initialTop + dy

    const maxLeft = window.innerWidth - container.offsetWidth
    const maxTop = window.innerHeight - container.offsetHeight
    newLeft = Math.max(0, Math.min(newLeft, maxLeft))
    newTop = Math.max(0, Math.min(newTop, maxTop))

    container.style.left = `${newLeft}px`
    container.style.top = `${newTop}px`
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return
    isDragging = false
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
    setTimeout(() => { hasMoved = false }, 100)
  }

  return { wasDragging: () => hasMoved }
}