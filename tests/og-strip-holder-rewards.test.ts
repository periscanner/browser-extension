// DOM-level: the "Holder rewards" icon on OG strip rows (isHolderRewards === true).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/similar-tokens-eacc-charity-2026-11-19.json'), 'utf8'))
const HOLDER = 'Chub6nKy5LcBRJESH4kdL3aV6Tqdy7ZfW69ajF61pump'
const CHARITY = '2PUJmgHHurTs46x7N8DJ499fTcHeJjxBSsVEo5CZpump'
const ORDINARY = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'

const row = (mint: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${mint}"]`)!
const icons = () => document.querySelectorAll('#psc-og-strip .psc-og-holder-rewards')

let initOgStrip: () => void
const observers: MutationObserver[] = []
const RealMO = MutationObserver
async function render(tokens: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener')
    ? { ok: true, json: async () => [] }
    : { ok: true, json: async () => ({ tokens, searchedToken: api.searchedToken }) }))
  initOgStrip()
  await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(tokens.length), { timeout: 3000 })
}
// the fixture's ordinary row, re-addressed as the holder-rewards coin
const holderRow = (extra: Record<string, unknown> = {}) => ({
  ...api.tokens.find((t: any) => t.baseToken.address === ORDINARY),
  baseToken: { ...api.tokens.find((t: any) => t.baseToken.address === ORDINARY).baseToken, address: HOLDER },
  isHolderRewards: true,
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

describe('OG strip holder-rewards icon', () => {
  it('shows an icon right after the ticker on the holder-rewards row only, tooltip "Holder rewards"', async () => {
    const charity = api.tokens.find((t: any) => t.baseToken.address === CHARITY)
    await render([holderRow(), charity])
    expect(icons().length).toBe(1)
    const icon = row(HOLDER).querySelector('.psc-og-ticker + .psc-og-holder-rewards')!
    expect(icon).not.toBeNull()
    expect(icon.getAttribute('title')).toBe('Holder rewards')
    expect(icon.querySelector('svg')).not.toBeNull()
    expect(row(CHARITY).querySelector('.psc-og-holder-rewards')).toBeNull()
    expect(row(CHARITY).querySelector('.psc-og-charity')).not.toBeNull() // heart untouched
  })

  it('only a literal true counts (attacker-safe): strings, numbers and objects render nothing', async () => {
    const hostile = ['true', 1, {}, '<img src=x onerror=window.__pwn=1>', null].map((v, i) =>
      holderRow({ baseToken: { ...holderRow().baseToken, address: `${ORDINARY.slice(0, -1)}${i}` }, isHolderRewards: v }))
    await render(hostile)
    expect(icons().length).toBe(0)
    expect(document.querySelector('#psc-og-strip img[src="x"]')).toBeNull()
    expect((window as any).__pwn).toBeUndefined()
  })

  it('a backend that never sends the field (not yet deployed) renders no icon', async () => {
    await render(api.tokens.map(({ isHolderRewards, ...t }: any) => t))
    expect(icons().length).toBe(0)
  })
})
