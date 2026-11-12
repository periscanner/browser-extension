// End-to-end for the OG strip on Axiom token pages: URL -> scanner-api -> rows
// in the DOM, for a direct load and an SPA navigation. The strip resolves the
// token from the URL id alone, so these run with NO Axiom localStorage at all
// (except the fallback test, which seeds it on purpose).
// Own file: initOgStrip installs a never-disconnected MutationObserver and
// module-level state, so it must not share a module instance with other suites.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initOgStrip } from '../src/content/ui/ogStrip'

const fx = (n: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8')
const captured: Record<string, any[]> = JSON.parse(fx('axiom-localStorage-2026-11-12.json'))
const [bonk, jewbots] = captured.recentTickerSolV2

// Distinct copies of a captured token: fetchLineage caches per URL id for the
// life of the module, so every fallback test needs ids no earlier test used.
const extras: any[] = []
const fresh = (base: any, tag: string) => {
  // unique name too: the strip re-renders the previous test's rows when the body is reset, so a shared ticker would make assertions pass vacuously
  const e = { ...base, tokenName: base.tokenName + tag, twoRows: base.tokenName === 'Bonk', tokenAddress: base.tokenAddress.slice(0, -2) + tag, pairAddress: base.pairAddress.slice(0, -2) + tag }
  extras.push(e)
  return e
}

const OTHER_MINT = 'So11111111111111111111111111111111111111112'

const row = (mint: string, symbol: string, axiomLink: string) => ({
  chainId: 'solana', dexId: 'pumpswap', pairAddress: 'pool-' + symbol,
  baseToken: { address: mint, name: symbol, symbol },
  priceUsd: '0', liquidity: { usd: 0 }, fdv: 0, marketCap: 12000, pairCreatedAt: 1794000000000,
  match: { ticker: true, name: true, image: false }, matchScore: 2, axiomLink,
})

// Stand-in for scanner-api's /extension/similar-tokens, keyed like the real one:
// `{ mint }` takes a mint or a pool id; `{ name, symbol }` is the legacy form.
const lineage = (e: any) => (e.tokenName === 'Bonk' || e.twoRows)
  ? [row(e.tokenAddress, e.tokenName, `https://axiom.trade/meme/${e.pairAddress}?chain=sol`), row(OTHER_MINT, 'BONK2', 'https://axiom.trade/meme/pool2?chain=sol')]
  : [row(e.tokenAddress, e.tokenName === 'PhantomMk1' ? 'Jewbots' : e.tokenName, `https://axiom.trade/meme/${e.pairAddress}?chain=sol`)]
let backendResolvesMints = true
const respond = (body: any) => {
  if (body.mint) {
    const e = backendResolvesMints && [bonk, jewbots, ...extras].find((t) => t.tokenAddress === body.mint || t.pairAddress === body.mint)
    return e
      ? { ok: true, json: async () => ({ tokens: lineage(e), searchedToken: { name: e.tokenName, symbol: e.tokenTicker, mint: e.tokenAddress } }) }
      : { ok: false, json: async () => ({ error: 'Could not resolve token from mint' }) }
  }
  const e = [bonk, jewbots, ...extras].find((t) => t.tokenName === body.name)!
  return { ok: true, json: async () => ({ tokens: lineage(e), searchedToken: { name: body.name, symbol: body.symbol } }) }
}

const goto = (path: string) => history.pushState({}, '', path)
const items = () => Array.from(document.querySelectorAll('#psc-og-strip .psc-og-item'))
const tickers = () => items().map((i) => i.querySelector('.psc-og-ticker')?.textContent)
const fetchMock = vi.fn()

beforeEach(() => {
  document.body.innerHTML = fx('axiom-token-page-2026-11-11.html')
  localStorage.clear() // Axiom's private storage is NOT needed
  backendResolvesMints = true
  fetchMock.mockReset().mockImplementation(async (_url: string, init: { body: string }) => respond(JSON.parse(init.body)))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('OG strip with no Axiom localStorage', () => {
  it('renders on a /token/<mint> direct load, then follows an SPA navigation', async () => {
    goto(`/token/${bonk.tokenAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(items()).toHaveLength(2), { timeout: 3000 })
    expect(items()[0].classList.contains('psc-og-item-current')).toBe(true) // the token in view
    // Others are clickable, to /token/<mint> built from the row's mint — even
    // though this (older-API) stand-in still returns /meme/<pool> axiomLinks.
    expect(items()[1].getAttribute('data-nav-path')).toBe(`/token/${OTHER_MINT}?chain=sol`)

    goto(`/token/${jewbots.tokenAddress}?chain=sol`)
    document.body.appendChild(document.createElement('i')) // Axiom re-render -> observer fires
    await vi.waitFor(() => expect(tickers()).toEqual(['Jewbots']), { timeout: 3000 })

    // One request per token, by the URL id — no polling for page metadata.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mint: bonk.tokenAddress })
  })

  it('still works on a legacy /meme/<pool> URL, highlighting the resolved mint', async () => {
    goto(`/meme/${bonk.pairAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(items()).toHaveLength(2), { timeout: 3000 })
    expect(items()[0].classList.contains('psc-og-item-current')).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mint: bonk.pairAddress })
  })
})

describe('OG strip fallback', () => {
  const seed = (...tokens: any[]) => localStorage.setItem('recentTickerSolV2', JSON.stringify(tokens))
  const legacyCalls = () => fetchMock.mock.calls.filter((c) => !JSON.parse(c[1].body).mint)

  it('uses Axiom localStorage when the backend cannot resolve the id', async () => {
    backendResolvesMints = false // e.g. a token too new for DexScreener, or an older backend
    const t = fresh(jewbots, 'aa')
    seed(t)
    goto(`/meme/${t.pairAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(tickers()).toEqual([t.tokenName]), { timeout: 3000 })
    expect(items()[0].classList.contains('psc-og-item-current')).toBe(true)
  })

  it('polls until Axiom writes its state late (direct load writes it ~5s in)', async () => {
    backendResolvesMints = false
    const t = fresh(jewbots, 'bb')
    goto(`/token/${t.tokenAddress}?chain=sol`)
    initOgStrip()
    setTimeout(() => seed(t), 1800)

    await vi.waitFor(() => expect(tickers()).toEqual([t.tokenName]), { timeout: 5000 })
    expect(legacyCalls()).toHaveLength(1)
  })

  it('falls back on a real 400 from the backend', async () => {
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body)
      return body.mint
        ? { ok: false, status: 400, json: async () => ({ error: 'name and symbol are required' }) }
        : respond(body)
    })
    const t = fresh(jewbots, 'cc')
    seed(t)
    goto(`/token/${t.tokenAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(tickers()).toEqual([t.tokenName]), { timeout: 3000 })
    expect(legacyCalls()).toHaveLength(1)
  })

  it('falls back on a network rejection', async () => {
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body)
      if (body.mint) throw new TypeError('Failed to fetch')
      return respond(body)
    })
    const t = fresh(jewbots, 'dd')
    seed(t)
    goto(`/token/${t.tokenAddress}?chain=sol`)
    initOgStrip()

    await vi.waitFor(() => expect(tickers()).toEqual([t.tokenName]), { timeout: 3000 })
    expect(legacyCalls()).toHaveLength(1)
  })

  it('stops polling when the user navigates to another token', async () => {
    backendResolvesMints = false
    const gone = fresh(jewbots, 'ee')
    const next = fresh(bonk, 'ff')
    goto(`/token/${gone.tokenAddress}?chain=sol`)
    initOgStrip()
    await new Promise((r) => setTimeout(r, 600)) // first poll cycle running
    goto(`/token/${next.tokenAddress}?chain=sol`)
    seed(next) // only the new token is in Axiom state; the old poll must not resolve `gone`
    document.body.appendChild(document.createElement('i'))

    await vi.waitFor(() => expect(tickers()).toEqual([next.tokenName, 'BONK2']), { timeout: 4000 })
    await new Promise((r) => setTimeout(r, 1200)) // let the abandoned poll tick
    expect(legacyCalls().map((c) => JSON.parse(c[1].body).name)).toEqual([next.tokenName])
  })
})
