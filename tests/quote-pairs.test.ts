import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearQuoteCache, getCachedQuote, loadQuotes, quoteLabel, SOL_MINT } from '../src/content/services/quotePairs'

const dex: any[] = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/dexscreener-tokens-v1-2026-11-19.json'), 'utf8'))
const WHATUP = 'AKDjR5f6sisQkJyhYdGHfqPtdXu9upZc4GZuH9GJpump' // pump.fun token paired to $TTWO
const SOL_PUMP = '7ge9CUEtZ4gQtMf9eiPf5Mk9Gv8j8wCds3m49tUVcHa1'
const fetchMock = vi.fn()

beforeEach(() => {
  clearQuoteCache()
  fetchMock.mockReset().mockImplementation(async () => ({ ok: true, json: async () => dex }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('quote pairs from DexScreener', () => {
  it('shows TTWO for the real example mint (live capture), SOL pair has no label', async () => {
    await loadQuotes([WHATUP, SOL_PUMP])
    expect(quoteLabel(getCachedQuote(WHATUP))).toBe('TTWO')
    expect(getCachedQuote(SOL_PUMP)?.address).toBe(SOL_MINT)
    expect(quoteLabel(getCachedQuote(SOL_PUMP))).toBeNull()
  })

  it('uses ONE batched request and caches (no refetch)', async () => {
    await loadQuotes([WHATUP, SOL_PUMP])
    await loadQuotes([WHATUP])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.dexscreener.com/tokens/v1/solana/${WHATUP},${SOL_PUMP}`)
  })

  it('prefers the pump.fun pair over higher-liquidity SOL pools of other dexes (bonded token also has Meteora SOL pools)', async () => {
    const meteoraSol = { dexId: 'meteora', baseToken: { address: WHATUP }, quoteToken: { address: SOL_MINT, symbol: 'SOL' }, liquidity: { usd: 999999 } }
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => [meteoraSol, ...dex] }))
    await loadQuotes([WHATUP])
    expect(quoteLabel(getCachedQuote(WHATUP))).toBe('TTWO')
  })

  it('a mint with no pump pair resolves to "no badge"', async () => {
    const raydium = { dexId: 'raydium', baseToken: { address: SOL_PUMP }, quoteToken: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' } }
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => [raydium] }))
    await loadQuotes([SOL_PUMP])
    expect(getCachedQuote(SOL_PUMP)).toBeNull()
  })

  it('degrades silently and retries later on HTTP error / network failure / junk', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }))
    await expect(loadQuotes([WHATUP])).resolves.toBeUndefined()
    expect(getCachedQuote(WHATUP)).toBeUndefined()
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline') })
    await loadQuotes([WHATUP])
    expect(getCachedQuote(WHATUP)).toBeUndefined()
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ pairs: 'nope' }) }))
    await loadQuotes([WHATUP])
    expect(getCachedQuote(WHATUP)).toBeUndefined()
    await loadQuotes([WHATUP]) // recovers
    expect(quoteLabel(getCachedQuote(WHATUP))).toBe('TTWO')
  })

  it('never puts a non-base58 id into the request URL', async () => {
    await loadQuotes(['../../evil', 'a,b', WHATUP])
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.dexscreener.com/tokens/v1/solana/${WHATUP}`)
  })

  it('chunks at 30 mints per request', async () => {
    const alpha = 'abcdefghijkmnopqrstuvwxyzABCDEFGH'
    const mints = Array.from({ length: 31 }, (_, i) => 'A'.repeat(40) + alpha[i] + 'z')
    await loadQuotes(mints)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('quoteLabel truncates and strips control / bidi characters from the attacker-controlled symbol', () => {
    expect(quoteLabel({ address: 'x', symbol: 'A‮B\u0000C' })).toBe('ABC')
    expect(quoteLabel({ address: 'x', symbol: 'ABCDEFGHIJKL' })).toBe('ABCDEFGH…')
    expect(quoteLabel({ address: 'x', symbol: '   ' })).toBeNull()
    expect(quoteLabel(null)).toBeNull()
  })
})
