
import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

export function useDraggable(target: Ref<HTMLElement | null>) {
  const isDragging = ref(false)
  const position = ref({ x: 0, y: 0 })
  const offset = ref({ x: 0, y: 0 })

  function onMouseDown(e: MouseEvent) {
    if (!target.value)
      return
    isDragging.value = true
    offset.value = {
      x: e.clientX - target.value.offsetLeft,
      y: e.clientY - target.value.offsetTop,
    }
    // Add event listeners
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseUp() {
    isDragging.value = false
    // Remove event listeners
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e: MouseEvent) {
    if (isDragging.value && target.value) {
      position.value = {
        x: e.clientX - offset.value.x,
        y: e.clientY - offset.value.y,
      }
      target.value.style.left = `${position.value.x}px`
      target.value.style.top = `${position.value.y}px`
    }
  }

  onMounted(() => {
    if (target.value)
      target.value.addEventListener('mousedown', onMouseDown)
  })

  onUnmounted(() => {
    if (target.value)
      target.value.removeEventListener('mousedown', onMouseDown)
  })
}
