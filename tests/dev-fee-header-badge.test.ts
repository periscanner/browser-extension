// Red chef hat after Axiom's "Send Alert To Lobby" megaphone, driven by the viewed token's own row.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/similar-tokens-eacc-charity-2026-11-19.json'), 'utf8'))
const STOCK = 'EzpzWgSuu9Ld9maCZwW97P4YqjQhETVrNXN5d84Ppump'
const CHARITY = '2PUJmgHHurTs46x7N8DJ499fTcHeJjxBSsVEo5CZpump'
const ORDINARY = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'
const find = (m: string) => api.tokens.find((t: any) => t.baseToken.address === m)
const stockRow = () => ({
  ...find(ORDINARY), baseToken: { ...find(ORDINARY).baseToken, address: STOCK }, isDevFeeStock: true,
})
const MEGA = '<div class="flex gap-[8px]" id="gap"><span class="contents"><button type="button" aria-label="Send Alert To Lobby"><i class="ri-megaphone-line"></i></button></span></div>'
const badges = () => document.querySelectorAll('#psc-dev-fee-header')

let initOgStrip: () => void
const observers: MutationObserver[] = []
const RealMO = MutationObserver
function mockApi(tokens: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('dexscreener')
    ? { ok: true, json: async () => [] }
    : { ok: true, json: async () => ({ tokens, searchedToken: api.searchedToken }) }))
}
const rows = (n: number) => vi.waitFor(() => expect(document.querySelectorAll('#psc-og-strip .psc-og-item').length).toBe(n), { timeout: 3000 })

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('MutationObserver', class extends RealMO { constructor(cb: MutationCallback) { super(cb); observers.push(this) } })
  ;({ initOgStrip } = await import('../src/content/ui/ogStrip'))
  document.body.innerHTML = `<div class="platform-app-shell"><div></div></div><div id="hdr">${MEGA}</div>`
})
afterEach(() => {
  observers.splice(0).forEach((o) => o.disconnect())
  vi.unstubAllGlobals()
})

describe('dev-fee chef hat in Axiom header', () => {
  it('shows after the megaphone when the viewed token is flagged', async () => {
    history.pushState({}, '', `/token/${STOCK}?chain=sol`)
    mockApi([stockRow(), find(ORDINARY)])
    initOgStrip()
    await vi.waitFor(() => expect(badges().length).toBe(1), { timeout: 3000 })
    const gap = document.getElementById('gap')!
    expect(gap.lastElementChild).toBe(badges()[0])
    expect(badges()[0].getAttribute('title')).toMatch(/Dev earns/)
    expect(badges()[0].querySelector('svg path')).not.toBeNull()
  })

  it('renders nothing when the viewed row has no flag', async () => {
    history.pushState({}, '', `/token/${CHARITY}?chain=sol`)
    mockApi([stockRow(), find(CHARITY)])
    initOgStrip()
    await rows(2)
    expect(badges().length).toBe(0)
  })

  it('renders nothing when the viewed token has no row', async () => {
    history.pushState({}, '', `/token/${CHARITY}?chain=sol`)
    mockApi([stockRow()])
    initOgStrip()
    await rows(2) // stockRow + synthesized placeholder
    expect(badges().length).toBe(0)
  })

  it('does not duplicate when Axiom re-renders the header', async () => {
    history.pushState({}, '', `/token/${STOCK}?chain=sol`)
    mockApi([stockRow(), find(ORDINARY)])
    initOgStrip()
    await vi.waitFor(() => expect(badges().length).toBe(1), { timeout: 3000 })
    document.getElementById('hdr')!.innerHTML = MEGA // wipe + re-render
    await vi.waitFor(() => expect(badges().length).toBe(1))
    document.getElementById('gap')!.appendChild(document.createElement('i')) // unrelated churn
    await new Promise((r) => setTimeout(r, 50))
    expect(badges().length).toBe(1)
  })

  it('is removed on navigation to a non-flagged token', async () => {
    history.pushState({}, '', `/token/${STOCK}?chain=sol`)
    mockApi([stockRow(), find(ORDINARY)])
    initOgStrip()
    await vi.waitFor(() => expect(badges().length).toBe(1), { timeout: 3000 })
    history.pushState({}, '', `/token/${ORDINARY}?chain=sol`)
    document.body.appendChild(document.createElement('i')) // trigger observer like Axiom's re-render
    await vi.waitFor(() => expect(badges().length).toBe(0), { timeout: 3000 })
  })
})
