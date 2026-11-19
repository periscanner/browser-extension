// DOM-level: the OG strip's light-blue "current" row must show for the token in
// view in every shape the lookup can come back in (captured WhatUp rows, 2026-11-19).
// Own file: initOgStrip keeps module-level state.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/similar-tokens-whatup-2026-11-19.json'), 'utf8'))
const [A, B, C] = api.tokens.filter((t: any) => t.matchScore >= 2) // J9k8, AKDj, 7ge9
const mintOf = (t: any) => t.baseToken.address as string

const items = () => Array.from(document.querySelectorAll('#psc-og-strip .psc-og-item'))
const currentMints = () => items().filter((i) => i.classList.contains('psc-og-item-current')).map((i) => (i as HTMLElement).dataset.mint)
const clone = (t: any, n: number) => ({ ...t, pairAddress: t.pairAddress.slice(0, -1) + n, baseToken: { ...t.baseToken, address: t.baseToken.address.slice(0, -5) + 'zzzz' + n } })

let initOgStrip: () => void
const observers: MutationObserver[] = []
const RealMO = MutationObserver
let respondWith: (body: any) => Promise<any>
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('MutationObserver', class extends RealMO { constructor(cb: MutationCallback) { super(cb); observers.push(this) } })
  ;({ initOgStrip } = await import('../src/content/ui/ogStrip'))
  document.body.innerHTML = '<div class="platform-app-shell"><div></div></div>'
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body: string }) =>
    String(url).includes('dexscreener') ? { ok: true, json: async () => [] } : respondWith(JSON.parse(init!.body))))
})
afterEach(() => {
  observers.splice(0).forEach((o) => o.disconnect())
  vi.unstubAllGlobals()
})
const ok = (tokens: any[], searchedToken: any) => async () => ({ ok: true, json: async () => ({ tokens, searchedToken }) })
const show = async (path: string, n: number) => {
  history.pushState({}, '', path)
  initOgStrip()
  await vi.waitFor(() => expect(items()).toHaveLength(n), { timeout: 3000 })
}

describe('OG strip current-row highlight', () => {
  it('baseline: highlights the row whose mint the backend reports', async () => {
    respondWith = ok(api.tokens, { name: 'WhatUp', symbol: 'WhatUp', mint: mintOf(B) })
    await show(`/token/${mintOf(B)}?chain=sol`, 3)
    expect(currentMints()).toEqual([mintOf(B)])
  })

  it('still highlights when the backend does not return searchedToken.mint (URL id is the mint)', async () => {
    respondWith = ok(api.tokens, { name: 'WhatUp', symbol: 'WhatUp' })
    await show(`/token/${mintOf(B)}?chain=sol`, 3)
    expect(currentMints()).toEqual([mintOf(B)])
  })

  it('highlights on a legacy /meme/<pool> URL by pool address when no mint comes back', async () => {
    respondWith = ok(api.tokens, { name: 'WhatUp', symbol: 'WhatUp' })
    await show(`/meme/${B.pairAddress}?chain=sol`, 3)
    expect(currentMints()).toEqual([mintOf(B)])
  })

  it('keeps the current token visible when it would fall past the 5-row cap', async () => {
    const many = [A, B, C, clone(A, 1), clone(A, 2), clone(A, 3), clone(A, 4)] // newest last
    const last = many[many.length - 1]
    respondWith = ok(many, { name: 'WhatUp', symbol: 'WhatUp', mint: mintOf(last) })
    await show(`/token/${mintOf(last)}?chain=sol`, 5)
    expect(currentMints()).toEqual([mintOf(last)])
    expect(items().map((i) => (i as HTMLElement).dataset.mint)).toEqual([mintOf(A), mintOf(B), mintOf(C), mintOf(many[3]), mintOf(last)])
  })

  it('shows the current token even when its own row scored below the match floor', async () => {
    const weak = { ...B, matchScore: 1 }
    respondWith = ok([A, weak, C], { name: 'WhatUp', symbol: 'WhatUp', mint: mintOf(B) })
    await show(`/token/${mintOf(B)}?chain=sol`, 3)
    expect(currentMints()).toEqual([mintOf(B)])
  })

  it('adds the current token from the lookup metadata when the API left it out', async () => {
    const OTHER = 'AKDjR5f6sisQkJyhYdGHfqPtdXu9upZc4GZuH9GJpump'.slice(0, -5) + 'qqqqq'
    respondWith = ok([A, C], { name: 'WhatUp', symbol: 'WhatUp', mint: OTHER, imageUrl: 'https://example.test/w.png' })
    await show(`/token/${OTHER}?chain=sol`, 3)
    expect(currentMints()).toEqual([OTHER])
    const cur = items().find((i) => (i as HTMLElement).dataset.mint === OTHER)!
    expect(cur.querySelector('.psc-og-mcap')).toBeNull() // no invented market data
    expect(cur.querySelector('.psc-og-current-tag')?.textContent).toBe('current')
  })

  it('SPA navigation to another row of the strip moves the highlight immediately, without a loading flash', async () => {
    respondWith = ok(api.tokens, { name: 'WhatUp', symbol: 'WhatUp', mint: mintOf(B) })
    await show(`/token/${mintOf(B)}?chain=sol`, 3)
    expect(currentMints()).toEqual([mintOf(B)])

    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    respondWith = async () => { await gate; return { ok: true, json: async () => ({ tokens: api.tokens, searchedToken: { name: 'WhatUp', symbol: 'WhatUp', mint: mintOf(A) } }) } }
    history.pushState({}, '', `/token/${mintOf(A)}?chain=sol`)
    document.body.appendChild(document.createElement('i')) // Axiom re-render -> observer fires
    await vi.waitFor(() => expect(currentMints()).toEqual([mintOf(A)]), { timeout: 300 })
    await new Promise((r) => setTimeout(r, 600)) // debounce elapsed, lookup still pending
    expect(document.querySelector('.psc-og-loading-text')).toBeNull()
    expect(currentMints()).toEqual([mintOf(A)])
    release()
    await vi.waitFor(() => expect(currentMints()).toEqual([mintOf(A)]))
  })
})
