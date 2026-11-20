// Red chef hat in Axiom's token-page header, right after Axiom's own
// "Send Alert To Lobby" megaphone. Anchored on the button's aria-label (not
// Tailwind classes) and appended to its gap container. Idempotent: at most one
// element; removed when the flag is false.
import { DEV_FEE_CHEF } from './devFee'

const BADGE_ID = 'psc-dev-fee-header'
const ANCHOR = 'button[aria-label="Send Alert To Lobby"]'

function remove() {
  document.querySelectorAll('#' + BADGE_ID).forEach((el) => el.remove())
}

export function syncDevFeeHeaderBadge(show: boolean): void {
  try {
    if (!show) return remove()
    const button = document.querySelector(ANCHOR)
    // Axiom wraps the button in a tooltip span; the gap container is its parent.
    const container = button?.parentElement?.parentElement
    if (!button || !container) return remove()
    const existing = document.querySelectorAll('#' + BADGE_ID)
    if (existing.length === 1 && existing[0].parentElement === container && container.lastElementChild === existing[0]) return
    remove()
    const tpl = document.createElement('template')
    tpl.innerHTML = DEV_FEE_CHEF // hardcoded constant, no interpolation
    const el = tpl.content.firstElementChild as HTMLElement
    el.id = BADGE_ID
    // The strip's CSS is scoped to #psc-og-strip, so size/colour inline here.
    el.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;width:16px;height:16px;color:#ef4444'
    const svg = el.querySelector('svg') as SVGElement | null
    if (svg) svg.style.cssText = 'width:100%;height:100%;display:block'
    container.appendChild(el)
  } catch {
    // Never break Axiom.
  }
}
