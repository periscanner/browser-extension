// The shared URL-id lookup used by the side panel (Similar tab, header
// metadata) and the OG strip: backend first, Axiom localStorage fallback only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupByUrlId } from '../src/content/services/tokenLookup'

// Valid base58, 44 chars, distinct per test (the lookup caches per URL id).
const id = (tag: string) => 'TokenLookup' + tag.padEnd(33, '1')
const goto = (path: string) => history.pushState({}, '', path)
const fetchMock = vi.fn()
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body))

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('lookupByUrlId', () => {
  it('resolves token metadata and lineage from the URL id with no localStorage, once', async () => {
    const mint = id('a')
    goto(`/token/${mint}?chain=sol`)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: [{ baseToken: { address: mint } }], searchedToken: { name: 'Alpha', symbol: 'ALP', imageUrl: 'https://x/a.png', mint } }),
    })

    const [a, b] = await Promise.all([lookupByUrlId(mint), lookupByUrlId(mint)]) // panel + strip
    expect(a).toMatchObject({ mint, name: 'Alpha', symbol: 'ALP', imageUrl: 'https://x/a.png' })
    expect(a!.tokens).toHaveLength(1)
    expect(b).toBe(a)
    expect(bodies()).toEqual([{ mint }])
  })

  it('falls back to Axiom localStorage only when the backend fails', async () => {
    const mint = id('b')
    goto(`/token/${mint}?chain=sol`)
    localStorage.setItem('recentTickerSolV2', JSON.stringify([
      { tokenAddress: mint, pairAddress: 'pool', tokenName: 'Beta', tokenTicker: 'BET', tokenImage: 'https://x/b.png' },
    ]))
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body)
      if (body.mint) throw new TypeError('Failed to fetch')
      return { ok: true, json: async () => ({ tokens: [], searchedToken: { name: body.name, symbol: body.symbol } }) }
    })

    const res = await lookupByUrlId(mint)
    expect(res).toMatchObject({ mint, name: 'Beta', symbol: 'BET', imageUrl: 'https://x/b.png' })
    expect(bodies()).toEqual([{ mint }, { name: 'Beta', symbol: 'BET', imageUrl: 'https://x/b.png' }])
  })

  it('returns null without polling forever when the user has navigated away', async () => {
    const mint = id('c')
    goto(`/token/${mint}?chain=sol`)
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'nope' }) })

    const p = lookupByUrlId(mint)
    await new Promise((r) => setTimeout(r, 100))
    goto(`/token/${id('d')}?chain=sol`)
    expect(await p).toBeNull()
  })
})
