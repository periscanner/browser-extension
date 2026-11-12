// Token lookup by the id in the page URL — shared by the OG strip and the side
// panel (Similar tab / scan header) so both resolve a token the same way:
// the backend resolves name/symbol/image + the lineage from the URL id alone
// (a mint, or a legacy /meme/<pool> id); Axiom's private localStorage list is
// only a fallback for what the backend can't resolve.
import { fetchSimilarTokens, fetchSimilarTokensById } from './api'
import { tokenFromAxiomState, extractTokenFromUrl } from './scanner'
import type { SimilarToken } from '../types'

export interface Lineage {
  tokens: SimilarToken[]
  /** Canonical mint of the token in view (null when the backend didn't say). */
  mint: string | null
  name?: string
  symbol?: string
  imageUrl?: string
}

// URL id -> lineage, plus in-flight dedupe so scrolling through tokens (which
// re-triggers on every SPA navigation) and the strip + panel asking for the
// same token don't hammer the API. Never explicitly cleared, so capped with
// oldest-entry eviction (Map preserves insertion order).
const MAX_CACHE_ENTRIES = 100
const lineageCache = new Map<string, Lineage>()
const inFlight = new Map<string, Promise<Lineage>>()

async function fetchLineage(urlId: string, load: () => Promise<Lineage>): Promise<Lineage> {
  const cached = lineageCache.get(urlId)
  if (cached) return cached
  const pending = inFlight.get(urlId)
  if (pending) return pending

  const promise = load()
    .then((lineage) => {
      if (lineageCache.size >= MAX_CACHE_ENTRIES && !lineageCache.has(urlId)) {
        const oldestKey = lineageCache.keys().next().value
        if (oldestKey !== undefined) lineageCache.delete(oldestKey)
      }
      lineageCache.set(urlId, lineage)
      return lineage
    })
    .finally(() => { inFlight.delete(urlId) })
  inFlight.set(urlId, promise)
  return promise
}

// Axiom writes `recentTickerSolV2` only ~5s into a direct page load, so a
// single read right after a backend miss can find a brand-new token absent.
// Poll briefly; give up early if the user navigated to another token.
const FALLBACK_POLL_MS = 500
const FALLBACK_MAX_MS = 6000

async function pollAxiomState(urlId: string) {
  const deadline = Date.now() + FALLBACK_MAX_MS
  for (;;) {
    const meta = tokenFromAxiomState(urlId)
    if (meta?.name && meta.symbol) return meta
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, FALLBACK_POLL_MS))
    if (extractTokenFromUrl() !== urlId) return null // navigated away
  }
}

/**
 * Resolve the token + its lineage from the URL id. Backend first; on any
 * failure (token too new for DexScreener, an older backend that doesn't accept
 * `mint`, a network error) fall back to polling Axiom's localStorage briefly.
 * Null when neither can resolve it.
 */
export async function lookupByUrlId(urlId: string): Promise<Lineage | null> {
  try {
    return await fetchLineage(urlId, async () => {
      const res = await fetchSimilarTokensById(urlId)
      const t = res.searchedToken
      return { tokens: res.tokens, mint: t?.mint ?? null, name: t?.name, symbol: t?.symbol, imageUrl: t?.imageUrl }
    })
  } catch {
    const meta = await pollAxiomState(urlId)
    if (!meta) return null
    return fetchLineage(urlId, async () => {
      const res = await fetchSimilarTokens(meta.name!, meta.symbol!, meta.image)
      return { tokens: res.tokens, mint: meta.mint, name: meta.name, symbol: meta.symbol, imageUrl: meta.image }
    })
  }
}
