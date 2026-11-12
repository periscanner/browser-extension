// End-to-end for the OG strip on Axiom token pages: URL -> Axiom localStorage ->
// scanner-api -> rows in the DOM, for a direct load and an SPA navigation.
// Own file: initOgStrip installs a never-disconnected MutationObserver and
// module-level state, so it must not share a module instance with other suites.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initOgStrip } from '../src/content/ui/ogStrip'

const fx = (n: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8')
const captured: Record<string, any[]> = JSON.parse(fx('axiom-localStorage-2026-11-12.json'))
const [bonk, jewbots] = captured.recentTickerSolV2

const row = (mint: string, symbol: string, axiomLink: string) => ({
  chainId: 'solana', dexId: 'pumpswap', pairAddress: 'pool-' + symbol,
  baseToken: { address: mint, name: symbol, symbol },
  priceUsd: '0', liquidity: { usd: 0 }, fdv: 0, marketCap: 12000, pairCreatedAt: 1794000000000,
  match: { ticker: true, name: true, image: false }, matchScore: 2, axiomLink,
})

const apiBody = (name: string) => name === 'Bonk'
  ? { tokens: [row(bonk.tokenAddress, 'Bonk', `https://axiom.trade/meme/${bonk.pairAddress}?chain=sol`), row('OtherMint1111111111111111111111111111111111', 'BONK2', 'https://axiom.trade/meme/pool2?chain=sol')] }
  : { tokens: [row(jewbots.tokenAddress, 'Jewbots', `https://axiom.trade/meme/${jewbots.pairAddress}?chain=sol`)] }

const goto = (path: string) => history.pushState({}, '', path)
const items = () => Array.from(document.querySelectorAll('#psc-og-strip .psc-og-item'))

beforeEach(() => {
  document.body.innerHTML = fx('axiom-token-page-2026-11-11.html')
  localStorage.setItem('recentTickerSolV2', JSON.stringify(captured.recentTickerSolV2))
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => ({
    ok: true,
    json: async () => apiBody(JSON.parse(init.body).name),
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('OG strip on /token/<mint> pages', () => {
  it('renders lineage rows on a direct load, then follows an SPA navigation', async () => {
    goto(`/token/${bonk.tokenAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(items()).toHaveLength(2), { timeout: 3000 })
    expect(items()[0].classList.contains('psc-og-item-current')).toBe(true) // the token in view
    expect(items()[1].getAttribute('data-nav-path')).toBeTruthy()           // others are clickable

    goto(`/token/${jewbots.tokenAddress}?chain=sol`)
    document.body.appendChild(document.createElement('i')) // Axiom re-render -> observer fires
    await vi.waitFor(
      () => expect(items().map((i) => i.querySelector('.psc-og-ticker')?.textContent)).toEqual(['Jewbots']),
      { timeout: 3000 },
    )
  })
})
