// DOM-level: the pump.fun charity-coin heart on OG strip rows. Fixture = the
// scanner-api row shape for charity coin 2PUJmgHH...pump (captured 2026-11-19).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/similar-tokens-eacc-charity-2026-11-19.json'), 'utf8'))
const CHARITY = '2PUJmgHHurTs46x7N8DJ499fTcHeJjxBSsVEo5CZpump'
const ORDINARY = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'

const row = (mint: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${mint}"]`)!
const hearts = () => document.querySelectorAll('#psc-og-strip .psc-og-charity')

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

describe('OG strip charity heart', () => {
  it('shows a heart right after the ticker on the charity row only', async () => {
    await render(api.tokens)
    expect(hearts().length).toBe(1)
    const heart = row(CHARITY).querySelector('.psc-og-ticker + .psc-og-charity')!
    expect(heart).not.toBeNull()
    expect(heart.getAttribute('title')).toMatch(/charity/i)
    expect(row(ORDINARY).querySelector('.psc-og-charity')).toBeNull()
  })

  it('only a literal true counts (attacker-safe): strings, numbers and objects render nothing', async () => {
    const hostile = ['true', 1, {}, '<img src=x onerror=window.__pwn=1>', null].map((v, i) => ({
      ...api.tokens[1],
      baseToken: { ...api.tokens[1].baseToken, address: `${ORDINARY.slice(0, -1)}${i}` },
      isCharity: v,
    }))
    await render(hostile)
    expect(hearts().length).toBe(0)
    expect(document.querySelector('#psc-og-strip img[src="x"]')).toBeNull()
    expect((window as any).__pwn).toBeUndefined()
  })

  it('a backend that never sends the field (not yet deployed) renders no heart', async () => {
    await render(api.tokens.map(({ isCharity, ...t }: any) => t))
    expect(hearts().length).toBe(0)
  })
})
