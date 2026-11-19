// DOM-level: the OG strip's avatar fallback chain, with real captured rows
// (scanner-api /extension/similar-tokens for "WhatUp", 2026-11-19, trimmed).
// Own file: initOgStrip keeps module-level state.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fx = (n: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8')
const api = JSON.parse(fx('similar-tokens-whatup-2026-11-19.json'))
const URL_MINT = 'AKDjR5f6sisQkJyhYdGHfqPtdXu9upZc4GZuH9GJpump'
const IPFS_MINT = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump' // image = https://ipfs.io/ipfs/<cid> (429s)
const EMPTY_MINT = '7ge9CUEtZ4gQtMf9eiPf5Mk9Gv8j8wCds3m49tUVcHa1' // imageUrl '' and not a ...pump mint

const rowEl = (mint: string) => document.querySelector(`#psc-og-strip .psc-og-item[data-mint="${mint}"]`)!
const avatar = (mint: string) => rowEl(mint).querySelector('.psc-og-avatar') as HTMLElement
const fail = (el: Element) => el.dispatchEvent(new Event('error'))

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
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener')
    ? { ok: true, json: async () => [] }
    : { ok: true, json: async () => ({ ...api, searchedToken: { ...api.searchedToken, mint: URL_MINT } }) }))
  history.pushState({}, '', `/token/${URL_MINT}?chain=sol`)
})
afterEach(() => {
  observers.splice(0).forEach((o) => o.disconnect())
  vi.unstubAllGlobals()
})

describe('OG strip avatar fallback chain', () => {
  it('walks every candidate before showing the letter glyph', async () => {
    initOgStrip()
    await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(3), { timeout: 3000 })

    // A dead ipfs.io url is never used as-is: pump CDN first.
    const img = avatar(IPFS_MINT) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.src).toBe(`https://images.pump.fun/coin-image/${IPFS_MINT}?variant=64x64`)

    fail(img)
    expect(img.src).toMatch(/^https:\/\/pump\.mypinata\.cloud\/ipfs\/bafkrei/)
    fail(img)
    expect(img.src).toMatch(/^https:\/\/gateway\.pinata\.cloud\/ipfs\/bafkrei/)
    expect(avatar(IPFS_MINT).tagName).toBe('IMG') // still an image
    fail(img)
    expect(avatar(IPFS_MINT).classList.contains('psc-og-glyph')).toBe(true) // last resort
    expect(avatar(IPFS_MINT).textContent).toBe('W')
  })

  it("another mint's Axiom CDN image (DexScreener mislabel, captured WhatUp row) is never used; the row's own pump CDN image is", async () => {
    initOgStrip()
    await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(3), { timeout: 3000 })
    const img = avatar(URL_MINT) as HTMLImageElement
    expect(img.src).toBe(`https://images.pump.fun/coin-image/${URL_MINT}?variant=64x64`)
    expect(rowEl(URL_MINT).innerHTML).not.toContain('7ZjNbCoy8xnXgQxW6NQH1LV9pjVPeS1FZnPbCqEYpump')
  })

  it("a healthy CDN image keyed by the row's own mint shows first and falls back to the pump CDN", async () => {
    const own = `https://axiom-sol-v2.sfo3.cdn.digitaloceanspaces.com/${URL_MINT}.webp`
    const tokens = api.tokens.map((t: any) => t.baseToken.address === URL_MINT ? { ...t, info: { imageUrl: own } } : t)
    ;(fetch as any).mockImplementation(async (url: string) => String(url).includes('dexscreener')
      ? { ok: true, json: async () => [] }
      : { ok: true, json: async () => ({ ...api, tokens, searchedToken: { ...api.searchedToken, mint: URL_MINT } }) })
    initOgStrip()
    await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(3), { timeout: 3000 })
    const img = avatar(URL_MINT) as HTMLImageElement
    expect(img.src).toBe(own)
    fail(img)
    expect(img.src).toBe(`https://images.pump.fun/coin-image/${URL_MINT}?variant=64x64`)
  })

  it('a row with no image anywhere gets the glyph straight away', async () => {
    initOgStrip()
    await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(3), { timeout: 3000 })
    expect(avatar(EMPTY_MINT).classList.contains('psc-og-glyph')).toBe(true)
  })

  it('stays escaped: hostile image urls never reach markup', async () => {
    const evil = { ...api.tokens[0], info: { imageUrl: 'https://x.test/a.png"><script>window.__pwn=1</script>' } }
    ;(fetch as any).mockImplementation(async (url: string) => String(url).includes('dexscreener')
      ? { ok: true, json: async () => [] }
      : { ok: true, json: async () => ({ tokens: [evil, ...api.tokens.slice(1)], searchedToken: { ...api.searchedToken, mint: 'evil' } }) })
    history.pushState({}, '', `/token/${IPFS_MINT}?chain=sol`)
    initOgStrip()
    await vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBeGreaterThan(0), { timeout: 3000 })
    expect(document.querySelector('#psc-og-strip script')).toBeNull()
    expect((window as any).__pwn).toBeUndefined()
  })
})
