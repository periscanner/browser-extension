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

const NO_PAIR_TTL_MS = 60_000 // "no pair yet" (fresh launch) is re-checked after this
const FAIL_BACKOFF_MS = 30_000 // skip DexScreener this long after a failed request

// mint -> quote (null = no pump pair found; expires so a fresh launch gets re-checked).
// Real quotes never expire. Oldest evicted.
const cache = new Map<string, { q: QuoteInfo | null; exp: number }>()
const inFlight = new Map<string, Promise<void>>()
let backoffUntil = 0

export function getCachedQuote(mint: string): QuoteInfo | null | undefined {
  const e = cache.get(mint)
  if (!e) return undefined
  if (e.q === null && Date.now() >= e.exp) { cache.delete(mint); return undefined }
  return e.q
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
  cache.delete(mint) // refresh insertion order
  cache.set(mint, { q, exp: q ? Infinity : Date.now() + NO_PAIR_TTL_MS })
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
  if (Date.now() < backoffUntil) return
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const url = safeHttpUrl(DEXSCREENER_TOKENS + mints.join(','))
    if (!url) return
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) { backoffUntil = Date.now() + FAIL_BACKOFF_MS; return }
    const data: unknown = await res.json()
    if (!Array.isArray(data)) { backoffUntil = Date.now() + FAIL_BACKOFF_MS; return }
    for (const [m, q] of pickQuotes(data as DexPair[], mints)) remember(m, q)
  } catch {
    // network / abort / bad JSON: no badge, back off before retrying
    backoffUntil = Date.now() + FAIL_BACKOFF_MS
  } finally {
    clearTimeout(timer)
  }
}

/** Fills the cache for any not-yet-known mints. Never throws. */
export async function loadQuotes(mints: string[]): Promise<void> {
  const todo = [...new Set(mints)].filter((m) => BASE58.test(m) && getCachedQuote(m) === undefined && !inFlight.has(m))
  const waits: Promise<void>[] = mints.filter((m) => inFlight.has(m)).map((m) => inFlight.get(m)!)
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH)
    const p = fetchBatch(chunk).finally(() => chunk.forEach((m) => inFlight.delete(m)))
    chunk.forEach((m) => inFlight.set(m, p))
    waits.push(p)
  }
  await Promise.all(waits)
}

export function clearQuoteCache() { cache.clear(); inFlight.clear(); backoffUntil = 0 }
