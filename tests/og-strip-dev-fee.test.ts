// DOM-level: the red chef hat on OG strip rows (isDevFeeStock === true), shown next to the quote badge.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/similar-tokens-eacc-charity-2026-11-19.json'), 'utf8'))
const STOCK = 'EzpzWgSuu9Ld9maCZwW97P4YqjQhETVrNXN5d84Ppump'
const CHARITY = '2PUJmgHHurTs46x7N8DJ499fTcHeJjxBSsVEo5CZpump'
const ORDINARY = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'

const row = (mint: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${mint}"]`)!
const icons = () => document.querySelectorAll('#psc-og-strip .psc-og-dev-fee')

let initOgStrip: () => void
const observers: MutationObserver[] = []
const RealMO = MutationObserver
const charityRow = () => api.tokens.find((t: any) => t.baseToken.address === CHARITY)
// the open (current) token's own row is always present, so rows == tokens + 0
async function render(tokens: unknown[]) {
  tokens = [...tokens, charityRow()]
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener')
    ? { ok: true, json: async () => [] }
    : { ok: true, json: async () => ({ tokens, searchedToken: api.searchedToken }) }))
  initOgStrip()
  await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(tokens.length), { timeout: 3000 })
}
const ordinary = () => api.tokens.find((t: any) => t.baseToken.address === ORDINARY)
const stockRow = (extra: Record<string, unknown> = {}) => ({
  ...ordinary(),
  baseToken: { ...ordinary().baseToken, address: STOCK },
  quoteToken: { address: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', symbol: 'AAPLx' },
  isDevFeeStock: true,
  ...extra,
})
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('MutationObserver', class extends RealMO { constructor(cb: MutationCallback) { super(cb); observers.push(this) } })
  ;({ initOgStrip } = await import('../src/content/ui/ogStrip'))
  document.body.innerHTML = '<div class="platform-app-shell"><div></div></div>'
  history.pushState({}, '', `/token/${CHARITY}?chain=sol`)
})
afterEach(() => {
  observers.splice(0).forEach((o) => o.disconnect())
  vi.unstubAllGlobals()
})

describe('OG strip dev-fee chef hat', () => {
  it('shows a red chef hat right after the quote badge on the flagged row only, quote badge kept', async () => {
    await render([stockRow(), ordinary()])
    expect(icons().length).toBe(1)
    const icon = row(STOCK).querySelector('.psc-og-quote + .psc-og-dev-fee')!
    expect(icon).not.toBeNull()
    expect(icon.getAttribute('title')).toMatch(/Dev earns/)
    expect(icon.querySelector('svg path')).not.toBeNull()
    expect(row(STOCK).querySelector('.psc-og-quote')!.textContent).toBe('/AAPLx')
    expect(row(ORDINARY).querySelector('.psc-og-dev-fee')).toBeNull()
    // red, and not the holder-rewards / charity icon
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('')
    expect(css).toMatch(/\.psc-og-dev-fee \{[^}]*color: #ef4444/)
    expect(row(STOCK).querySelector('.psc-og-holder-rewards, .psc-og-charity')).toBeNull()
  })

  it('a plain SOL coin row (no field) and an explicit false render nothing', async () => {
    await render([ordinary(), stockRow({ isDevFeeStock: false, baseToken: { ...ordinary().baseToken, address: `${ORDINARY.slice(0, -1)}1` } })])
    expect(icons().length).toBe(0)
  })

  it('only a literal true counts (attacker-safe): strings, numbers and objects render nothing', async () => {
    const hostile = ['true', 1, {}, '<img src=x onerror=window.__pwn=1>'].map((v, i) =>
      stockRow({ baseToken: { ...ordinary().baseToken, address: `${ORDINARY.slice(0, -1)}${i}` }, isDevFeeStock: v }))
    await render(hostile)
    expect(icons().length).toBe(0)
    expect(document.querySelector('#psc-og-strip img[src="x"]')).toBeNull()
    expect((window as any).__pwn).toBeUndefined()
  })

  it('a backend that never sends the field (not yet deployed) renders no icon', async () => {
    await render(api.tokens.filter((t: any) => t.baseToken.address !== CHARITY).slice(0, 3).map(({ isDevFeeStock, ...t }: any) => t))
    expect(icons().length).toBe(0)
  })
})
