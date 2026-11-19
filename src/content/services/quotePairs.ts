// Quote-token ("/TTWO") lookup for the OG strip. pump.fun tokens can be paired
// against a non-SOL quote mint (a token or a tokenised stock). scanner-api's
// similar-tokens rows carry no quoteToken, so ask DexScreener directly: one
// batched call (up to 30 mints) per strip render, CORS-open, no API key, no
// backend change. If a newer scanner-api ever returns `quoteToken` on a row,
// the strip uses that and skips this call.
import { safeHttpUrl } from '../utils/escape'

export interface QuoteInfo { address: string; symbol: string }

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/tokens/v1/solana/'
const BATCH = 30
const TIMEOUT_MS = 6000
const MAX_CACHE = 500
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const PUMP_DEXES = new Set(['pumpfun', 'pumpswap'])
const MAX_SYMBOL = 8

// mint -> quote (null = looked up, SOL / unknown / not a pump pair). Oldest evicted.
const cache = new Map<string, QuoteInfo | null>()
const inFlight = new Map<string, Promise<void>>()

export function getCachedQuote(mint: string): QuoteInfo | null | undefined {
  return cache.get(mint)
}

/** Display form of a quote: null for SOL (nothing to show). Symbol is
 *  attacker-controlled token metadata — callers must still escape it. */
export function quoteLabel(q: QuoteInfo | null | undefined): string | null {
  if (!q || q.address === SOL_MINT) return null
  const sym = q.symbol.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim()
  if (!sym) return null
  return sym.length > MAX_SYMBOL ? sym.slice(0, MAX_SYMBOL) + '…' : sym
}

function remember(mint: string, q: QuoteInfo | null) {
  if (cache.size >= MAX_CACHE && !cache.has(mint)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(mint, q)
}

interface DexPair {
  dexId?: string
  baseToken?: { address?: string }
  quoteToken?: { address?: string; symbol?: string }
  liquidity?: { usd?: number }
}

// Per mint: the pump.fun pair (bonding curve or its pumpswap pool) with the most
// liquidity. A bonded token also has SOL-quoted Meteora pools; those are ignored
// since the question is what the pump token itself is paired to.
function pickQuotes(pairs: DexPair[], mints: string[]): Map<string, QuoteInfo | null> {
  const best = new Map<string, DexPair>()
  for (const p of pairs) {
    const base = p.baseToken?.address
    if (!base || !mints.includes(base) || !PUMP_DEXES.has(p.dexId ?? '')) continue
    if (typeof p.quoteToken?.address !== 'string' || typeof p.quoteToken?.symbol !== 'string') continue
    const cur = best.get(base)
    if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(base, p)
  }
  const out = new Map<string, QuoteInfo | null>()
  for (const m of mints) {
    const p = best.get(m)
    out.set(m, p ? { address: p.quoteToken!.address!, symbol: p.quoteToken!.symbol! } : null)
  }
  return out
}

async function fetchBatch(mints: string[]): Promise<void> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const url = safeHttpUrl(DEXSCREENER_TOKENS + mints.join(','))
    if (!url) return
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return // leave uncached: retry on the next render
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return
    for (const [m, q] of pickQuotes(data as DexPair[], mints)) remember(m, q)
  } catch {
    // network / abort / bad JSON: no badge, retry next render
  } finally {
    clearTimeout(timer)
  }
}

/** Fills the cache for any not-yet-known mints. Never throws. */
export async function loadQuotes(mints: string[]): Promise<void> {
  const todo = [...new Set(mints)].filter((m) => BASE58.test(m) && !cache.has(m) && !inFlight.has(m))
  const waits: Promise<void>[] = mints.filter((m) => inFlight.has(m)).map((m) => inFlight.get(m)!)
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH)
    const p = fetchBatch(chunk).finally(() => chunk.forEach((m) => inFlight.delete(m)))
    chunk.forEach((m) => inFlight.set(m, p))
    waits.push(p)
  }
  await Promise.all(waits)
}

export function clearQuoteCache() { cache.clear(); inFlight.clear() }
