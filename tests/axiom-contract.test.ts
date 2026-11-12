// Guards the two Axiom-side contracts the OG lineage strip depends on.
// Fixtures are captured from live axiom.trade; see "Refreshing Axiom fixtures" in CONTEXT.md.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { tokenFromAxiomState } from '../src/content/services/scanner'
import { ensureInjected } from '../src/content/ui/ogStrip'

const fx = (n: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8')
// A captured slice of axiom.trade's localStorage: { <key Axiom wrote>: <list> }.
// Seeding every captured key verbatim is what makes this a contract test — if
// Axiom renames the key again, a refreshed capture carries the new name and
// this suite goes red until the code follows (it stayed green through the
// recentTickerSol -> recentTickerSolV2 rename because it seeded the key the
// code already read).
const captured: Record<string, unknown[]> = JSON.parse(fx('axiom-localStorage-2026-11-12.json'))
const seedAxiomStorage = () => {
  for (const [key, list] of Object.entries(captured)) localStorage.setItem(key, JSON.stringify(list))
}
const [entry] = captured.recentTickerSolV2 as any[]

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('OG strip anchor', () => {
  it('mounts under .platform-app-shell, just before the main content', () => {
    document.body.innerHTML = fx('axiom-token-page-2026-11-11.html')
    const strip = ensureInjected()
    const shell = document.querySelector('.platform-app-shell')!
    expect(strip).not.toBeNull()
    expect(strip!.parentElement).toBe(shell)
    expect(strip!.nextElementSibling).toBe(shell.lastElementChild)
  })
})

describe('tokenFromAxiomState', () => {
  beforeEach(seedAxiomStorage)

  it('reads the key Axiom writes today', () => {
    expect(Object.keys(captured)).toEqual(['recentTickerSolV2'])
  })
  it('resolves a /token/<mint> id', () => {
    expect(tokenFromAxiomState(entry.tokenAddress)).toMatchObject({
      mint: entry.tokenAddress,
      symbol: 'Bonk',
      name: 'Bonk',
    })
  })
  it('resolves a legacy /meme/<pool> id', () => {
    expect(tokenFromAxiomState(entry.pairAddress)?.mint).toBe(entry.tokenAddress)
  })
  it('misses an unknown id', () => {
    expect(tokenFromAxiomState('nope')).toBeNull()
  })
  it('ignores the abandoned pre-V2 key (stale since 2026-11-04)', () => {
    localStorage.clear()
    localStorage.setItem('recentTickerSol', JSON.stringify(captured.recentTickerSolV2))
    expect(tokenFromAxiomState(entry.tokenAddress)).toBeNull()
  })
})
