// OG strip: a row for a coin DexScreener doesn't list (no market fields, maybe no date).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const A = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'
const B = '2PUJmgHHurTs46x7N8DJ499fTcHeJjxBSsVEo5CZpump'
const normal = { chainId: 'solana', dexId: 'pumpfun', pairAddress: A, baseToken: { address: A, name: 'Alpha', symbol: 'ALP' },
  priceUsd: '0.1', liquidity: { usd: 5000 }, fdv: 80000, marketCap: 80000, pairCreatedAt: 1700000000000,
  info: { imageUrl: '' }, match: {}, matchScore: 3, axiomLink: '', bonded: true }
const bare = { chainId: 'solana', dexId: '', pairAddress: B, baseToken: { address: B, name: 'Beta', symbol: 'BET' },
  info: { imageUrl: '' }, match: {}, matchScore: 3, axiomLink: '', pairCreatedAtSource: 'unknown' }

let initOgStrip: () => void
const observers: MutationObserver[] = []
const RealMO = MutationObserver
async function render(tokens: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener')
    ? { ok: true, json: async () => [] }
    : { ok: true, json: async () => ({ tokens, searchedToken: { mint: A } }) }))
  initOgStrip()
  await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(tokens.length), { timeout: 3000 })
}
const row = (m: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${m}"]`)!
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('MutationObserver', class extends RealMO { constructor(cb: MutationCallback) { super(cb); observers.push(this) } })
  ;({ initOgStrip } = await import('../src/content/ui/ogStrip'))
  document.body.innerHTML = '<div class="platform-app-shell"><div></div></div>'
  history.pushState({}, '', `/token/${A}?chain=sol`)
})
afterEach(() => { observers.splice(0).forEach((o) => o.disconnect()); vi.unstubAllGlobals() })

describe('OG strip rows without market data', () => {
  it('shows no $0 and no ? for a row lacking market fields', async () => {
    await render([normal, bare])
    const t = row(B).textContent!
    expect(t).not.toContain('$0')
    expect(t).not.toContain('?')
    expect(row(B).querySelector('.psc-og-mcap')).toBeNull()
    expect(row(B).querySelector('.psc-og-date')).toBeNull()
  })
  it('leaves a normal row unchanged', async () => {
    await render([normal, bare])
    expect(row(A).querySelector('.psc-og-mcap')!.textContent).toBe('$80K')
    expect(row(A).querySelector('.psc-og-date')!.textContent).toMatch(/^\d\d-\d\d-\d{4}:/)
    expect(row(A).querySelector('.psc-og-bonded')).not.toBeNull()
  })
})
