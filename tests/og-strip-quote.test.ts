// DOM-level: the "/TTWO" quote badge on OG strip rows, with real captured data
// (scanner-api rows + DexScreener /tokens/v1 for pump.fun token "WhatUp", paired
// to $TTWO, 2026-11-19). Own file: initOgStrip keeps module-level state.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fx = (n: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8'))
const api = fx('similar-tokens-whatup-2026-11-19.json')
const dex = fx('dexscreener-tokens-v1-2026-11-19.json')
const TTWO_MINT = 'AKDjR5f6sisQkJyhYdGHfqPtdXu9upZc4GZuH9GJpump'
const SOL_MINT_ROW = '7ge9CUEtZ4gQtMf9eiPf5Mk9Gv8j8wCds3m49tUVcHa1'

const rows = () => Array.from(document.querySelectorAll('#psc-og-strip .psc-og-item'))
const badge = (mint: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${mint}"] .psc-og-quote`)!
const apiBody = (tokens = api.tokens) => ({ ok: true, json: async () => ({ tokens, searchedToken: { ...api.searchedToken, mint: TTWO_MINT } }) })
let dexFetch: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>

// initOgStrip installs a never-disconnected observer and module-level state: fresh modules per test
let initOgStrip: () => void
// initOgStrip's observer is never disconnected by design; track and drop it so a finished test can't re-render into the next one
const observers: MutationObserver[] = []
const RealMO = MutationObserver
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('MutationObserver', class extends RealMO { constructor(cb: MutationCallback) { super(cb); observers.push(this) } })
  ;({ initOgStrip } = await import('../src/content/ui/ogStrip'))
  document.body.innerHTML = '<div class="platform-app-shell"><div></div></div>'
  dexFetch = vi.fn(async (_url: string) => ({ ok: true, json: async () => dex }))
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener') ? dexFetch(url) : apiBody()))
  history.pushState({}, '', `/token/${TTWO_MINT}?chain=sol`)
})
afterEach(() => {
  observers.splice(0).forEach((o) => o.disconnect())
  vi.unstubAllGlobals()
})

describe('OG strip quote badge', () => {
  it('shows /TTWO on the TTWO-paired row and nothing on SOL pairs, with one batched lookup', async () => {
    initOgStrip()
    await vi.waitFor(() => expect(badge(TTWO_MINT).textContent).toBe('/TTWO'), { timeout: 3000 })
    expect(badge(SOL_MINT_ROW).textContent).toBe('')
    expect(rows()).toHaveLength(3)
    expect(dexFetch).toHaveBeenCalledTimes(1)
    expect(dexFetch.mock.calls[0][0]).toContain('/tokens/v1/solana/')
  })

  it('degrades gracefully: DexScreener down -> rows render, no badge', async () => {
    dexFetch.mockImplementation(async () => { throw new Error('offline') })
    initOgStrip()
    await vi.waitFor(() => expect(rows()).toHaveLength(3), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 50))
    expect(badge(TTWO_MINT).textContent).toBe('')
  })

  it('uses quoteToken from a newer API without asking DexScreener', async () => {
    const tokens = api.tokens.map((t: any) => ({ ...t, quoteToken: { address: 'TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo', symbol: 'TTWO' } }))
    ;(fetch as any).mockImplementation(async () => apiBody(tokens))
    initOgStrip()
    await vi.waitFor(() => expect(badge(TTWO_MINT).textContent).toBe('/TTWO'), { timeout: 3000 })
    expect(dexFetch).not.toHaveBeenCalled()
  })

  it('escapes a hostile quote symbol', async () => {
    const evil = dex.map((p: any) => p.baseToken.address === TTWO_MINT ? { ...p, quoteToken: { ...p.quoteToken, symbol: '<img src=x onerror=window.__pwn=1>' } } : p)
    dexFetch.mockImplementation(async () => ({ ok: true, json: async () => evil }))
    initOgStrip()
    await vi.waitFor(() => expect(badge(TTWO_MINT).textContent).toContain('<img'), { timeout: 3000 })
    expect(badge(TTWO_MINT).querySelector('img')).toBeNull()
    expect(badge(TTWO_MINT).textContent!.length).toBeLessThanOrEqual(10)
  })
})
