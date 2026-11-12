// Guards the two Axiom-side contracts the OG lineage strip depends on.
// Fixtures are captured from live axiom.trade; see "Refreshing Axiom fixtures" in CONTEXT.md.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { tokenFromAxiomState } from '../src/content/services/scanner'
import { ensureInjected } from '../src/content/ui/ogStrip'

const fx = (n: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', n), 'utf8')
const state = fx('axiom-recentTickerSol-2026-11-11.json')
const [entry] = JSON.parse(state)

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
  beforeEach(() => localStorage.setItem('recentTickerSol', state))

  it('resolves a /token/<mint> id', () => {
    expect(tokenFromAxiomState(entry.tokenAddress)?.mint).toBe(entry.tokenAddress)
  })
  it('resolves a legacy /meme/<pool> id', () => {
    const t = tokenFromAxiomState(entry.pairAddress)
    expect(t).toMatchObject({ mint: entry.tokenAddress, symbol: 'MORTGAGE', name: 'MortgageCoin' })
  })
  it('misses an unknown id', () => {
    expect(tokenFromAxiomState('nope')).toBeNull()
  })
})
