// OG lineage strip — a compact horizontal row of up to 5 relaunch/copycat
// tokens (matchScore >= 2, oldest-first per the API), injected directly into
// Axiom's own page chrome so you can jump between relaunches without opening
// the Periscanner panel. Lives OUTSIDE #cluster-scanner-widget and is fully
// decoupled from the panel's scan/reset lifecycle — it works with the panel
// closed and never calls runScan or any Helius-backed endpoint.
//
// Never throws into the page: every entry point is wrapped so a failure here
// silently does nothing rather than breaking Axiom.

import { fetchSimilarTokens } from '../services/api'
import { tokenFromAxiomState, extractTokenFromUrl } from '../services/scanner'
import type { AxiomToken } from '../services/scanner'
import { formatCompactUsd } from '../utils/format'
import { escapeHtml, safeImageUrl } from '../utils/escape'
import { SimilarToken } from '../types'

const STRIP_ID = 'psc-og-strip'
const STYLE_ID = 'psc-og-strip-styles'
const SHELL_SELECTOR = '.platform-app-shell'
const NAV_EVENT = 'psc:navigate'

// Same floor as the Similar tab / telegram bot's /og lineage — a matchScore-1
// row (ticker OR name OR image alone) turns up unrelated coins on a common
// word, so the strip only ever shows the strong (2+ signal) lineage.
const MIN_MATCH_SCORE = 2
const MAX_ROWS = 5
const BONDED_MC = 60000

// lineageCache is never explicitly cleared and the strip auto-loads on every
// SPA navigation, so cap it and evict the oldest entry (Map preserves
// insertion order) rather than letting it grow for the life of the page.
const MAX_CACHE_ENTRIES = 100

// Metadata (from Axiom's own localStorage) isn't always populated the instant
// a fresh token's DOM appears — Axiom only writes `recentTickerSol` once its
// own token view finishes mounting, and on a cold hard load (extension
// reload, or a /meme/<pool> URL opened directly) that can easily land past a
// couple of seconds. Retry on a long backoff ladder (~20s total) rather than
// giving up early — the strip shows a loading placeholder the whole time (see
// renderLoading below), so running the ladder all the way out is safe. Never
// falls back to a scan (burn guardrail).
const METADATA_RETRY_DELAYS = [300, 800, 1500, 3000, 5000, 8000]

let stripEl: HTMLElement | null = null
let lastTokens: SimilarToken[] | null = null
// meta.mint for lastTokens — kept alongside it so the detach-repair path in
// initOgStrip can re-render the "current row" highlight without re-fetching.
let lastCurrentMint: string | null = null
// True while the strip is showing the loading placeholder rather than real
// content — lets the detach-repair path restore the right one of the two.
let isLoadingStrip = false
let navDebounce: ReturnType<typeof setTimeout> | null = null

// mint -> lineage, plus in-flight dedupe so scrolling through tokens (which
// re-triggers on every SPA navigation) doesn't hammer the API.
const lineageCache = new Map<string, SimilarToken[]>()
const inFlight = new Map<string, Promise<SimilarToken[]>>()

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* Scoped to #psc-og-strip only — this sits in Axiom's own Tailwind tree,
       not inside #cluster-scanner-widget, so nothing here may rely on
       inherited styles and nothing here may leak out. */
    #psc-og-strip {
      --ps-bg-2: #18181b;
      --ps-border: #27272a;
      --ps-azure-hi: #38bdf8;
      --ps-z300: #d4d4d8;
      --ps-z400: #a1a1aa;
      --ps-z600: #52525b;
      --ps-z700: #3f3f46;

      /* Always flex, never display:none — the strip's 26.284px band is
         reserved on every axiom.trade page the shell exists on (pulse,
         discover, token pages alike) so a token's rows swap into
         already-occupied space instead of pushing Axiom's content area down
         when they load. Empty is a valid, permanent state (background +
         border, no rows) — see renderStrip. */
      display: flex;
      align-items: center;
      height: 26.284px;
      min-height: 26.284px;
      max-height: 26.284px;
      flex: 0 1 auto;
      padding: 0 12px;
      background: #06070B;
      border-bottom: 1px solid var(--ps-border);
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
      overflow: hidden;
    }
    #psc-og-strip, #psc-og-strip * , #psc-og-strip *::before, #psc-og-strip *::after {
      box-sizing: border-box;
    }
    #psc-og-strip .psc-og-track {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
      scrollbar-width: thin;
    }
    #psc-og-strip .psc-og-track::-webkit-scrollbar { height: 4px; }
    #psc-og-strip .psc-og-track::-webkit-scrollbar-thumb { background: var(--ps-z700); border-radius: 4px; }
    #psc-og-strip .psc-og-track::-webkit-scrollbar-track { background: transparent; }
    #psc-og-strip .psc-og-item {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 22px;
      padding: 0 8px 0 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--ps-border);
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
      white-space: nowrap;
    }
    #psc-og-strip .psc-og-item:hover {
      background: rgba(14, 165, 233, 0.08);
      border-color: rgba(14, 165, 233, 0.3);
    }
    /* The row for the token already in view — accent styling instead of the
       hover treatment, and the hover rule is intentionally re-stated
       unchanged below (later in source order wins at equal specificity) so
       hovering it gives no "this is clickable" feedback. */
    #psc-og-strip .psc-og-item-current {
      cursor: default;
      background: rgba(56, 189, 248, 0.1);
      border-color: rgba(56, 189, 248, 0.45);
    }
    #psc-og-strip .psc-og-item-current:hover {
      background: rgba(56, 189, 248, 0.1);
      border-color: rgba(56, 189, 248, 0.45);
    }
    #psc-og-strip .psc-og-current-tag {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ps-azure-hi);
      opacity: 0.85;
    }
    #psc-og-strip .psc-og-avatar {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--ps-bg-2);
      border: 1px solid var(--ps-border);
    }
    #psc-og-strip .psc-og-glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 700;
      color: var(--ps-z400);
    }
    #psc-og-strip .psc-og-ticker {
      font-size: 11px;
      font-weight: 700;
      color: var(--ps-azure-hi);
      letter-spacing: -0.01em;
    }
    #psc-og-strip .psc-og-name {
      font-size: 10px;
      color: var(--ps-z400);
      max-width: 90px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #psc-og-strip .psc-og-sep {
      color: var(--ps-z600);
      font-size: 10px;
    }
    #psc-og-strip .psc-og-mono {
      font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    #psc-og-strip .psc-og-mcap { font-size: 10px; color: var(--ps-z300); }
    #psc-og-strip .psc-og-date { font-size: 9px; color: var(--ps-z600); }
    #psc-og-strip .psc-og-bonded { font-size: 10px; line-height: 1; flex-shrink: 0; }
    /* Remix Icon glyph, loaded globally by Axiom (our strip is injected into
       its DOM, so the [class^="ri-"] font rule applies here too). Fixed
       width/height + no margin so that if Axiom ever stops loading the font,
       the <i> collapses to an empty-but-identically-sized box instead of a
       stray gap or a reflow — the surrounding spacing comes entirely from
       the parent's flex gap, never from margin on this element. */
    #psc-og-strip .psc-og-fee-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      font-size: 11px;
      line-height: 1;
      flex-shrink: 0;
      margin: 0;
    }
    /* Loading placeholder — static (no pulse/shimmer) so the 26.284px bar
       never flashes or draws attention to itself; it's a quiet "still
       working". */
    #psc-og-strip .psc-og-loading-text {
      flex-shrink: 0;
      font-size: 10px;
      color: var(--ps-z600);
      white-space: nowrap;
    }
    #psc-og-strip .psc-og-skeleton {
      flex-shrink: 0;
      height: 22px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--ps-border);
    }
  `
  document.head.appendChild(style)
}

// Idempotent: reuses the existing node if it's still attached under the
// shell, otherwise (re)creates it — Axiom's Next.js App Router re-renders and
// can wipe injected nodes, so this must never create duplicates.
function ensureInjected(): HTMLElement | null {
  const existing = document.getElementById(STRIP_ID) as HTMLElement | null
  if (existing && existing.isConnected) {
    stripEl = existing
    return existing
  }

  const shell = document.querySelector(SHELL_SELECTOR) as HTMLElement | null
  if (!shell || !shell.lastElementChild) return null // shell not mounted yet — try again next tick

  const strip = document.createElement('div')
  strip.id = STRIP_ID
  strip.className = 'psc-og-strip'
  // No visible label (the rows speak for themselves) — a title attribute
  // keeps a hover affordance instead of spending permanent strip real estate.
  strip.title = 'Lineage: relaunch/copycat tokens for this coin, oldest first'
  strip.innerHTML = '<div class="psc-og-track"></div>'
  // The main content area is always the shell's last (only growing) child —
  // insert immediately before it so the strip sits as the last piece of
  // chrome, stable regardless of whether the alert banner above it is present.
  shell.lastElementChild.insertAdjacentElement('beforebegin', strip)
  stripEl = strip
  return strip
}

// DD-MM-YYYY:HH-MM-SS, local time, zero-padded. "?" when pairCreatedAt is
// missing/0. Distinct from render.ts's formatExactDate (UTC, different
// separators) — that one backs the Similar tab, this is its own format.
function formatOgDate(pairCreatedAt?: number): string {
  if (!pairCreatedAt) return '?'
  const d = new Date(pairCreatedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}:` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

// Token name/symbol/image and axiomLink are all attacker-controlled (Solana
// metadata is unrestricted, and /extension/similar-tokens matches on
// name/ticker/image similarity — a deliberately-collided token can land in a
// popular coin's strip for every viewer). This markup is injected straight
// into axiom.trade's own document via innerHTML, so every interpolated value
// below MUST be escaped — this is the one thing not to regress.
// escapeHtml/safeImageUrl live in ../utils/escape (shared with render.ts,
// same threat model, same innerHTML sink) — do not redefine them here.

// Strip the origin off axiomLink (preserving path + query, e.g. ?chain=sol),
// falling back to the canonical /meme/<mint> path if it's ever malformed —
// or if what's left isn't a same-origin relative path (must start with a
// single '/', not protocol-relative '//'). This value is later handed to
// window.location.href by the MAIN-world bridge (mainworld.ts), so anything
// looser here is an open-redirect / javascript: sink.
function navPathFor(token: SimilarToken): string {
  const fallback = `/meme/${token.baseToken.address}?chain=sol`
  try {
    const u = new URL(token.axiomLink)
    const path = u.pathname + u.search
    if (path.startsWith('/') && !path.startsWith('//')) return path
    return fallback
  } catch {
    return fallback
  }
}

// pump.fun creator-fee indicator. `feeCategory` arrives from the API — same
// attacker-controlled surface as name/ticker/image above — so it is NEVER
// interpolated into markup directly. Only the two exact, hardcoded string
// literals below are recognised; the `feeCategory !== ... && !== ...` guard
// runs before the frozen lookup is ever touched, so an arbitrary string
// (including things like "__proto__") can't reach the object at all.
// `'default'`, `undefined`, or anything else falls through to '' — no icon.
// Classes are Axiom's own Remix Icon classes (its global
// `[class^="ri-"]` font rule applies to our injected elements too); colors
// are hardcoded from Axiom's live computed styles rather than depending on
// its Tailwind classes, which could change independently of the icon glyphs.
const FEE_ICONS = Object.freeze({
  cashback: Object.freeze({ cls: 'ri-refund-2-line', color: '#FFD700', title: 'Cashback enabled' }),
  fee_share: Object.freeze({ cls: 'ri-pie-chart-2-line', color: '#86EFAC', title: 'Fee sharing enabled' }),
} as const)

function feeIconHtml(feeCategory: SimilarToken['feeCategory']): string {
  if (feeCategory !== 'cashback' && feeCategory !== 'fee_share') return ''
  const icon = FEE_ICONS[feeCategory]
  return `<i class="psc-og-fee-icon ${icon.cls}" style="color: ${icon.color};" title="${icon.title}"></i>`
}

// `isCurrent` marks the row for the token already open in this tab (compared
// by mint — meta.mint from tokenFromAxiomState — not the URL's pool id, since
// lineage rows carry mints and the URL carries a pool id). That row gets
// accent styling and, critically, no data-nav-path attribute at all, so
// wireItemEvents' `if (path)` guard turns its click into a no-op instead of a
// navigation back to the page already showing (verified live: previously it
// pointed at itself and felt broken).
function itemHtml(token: SimilarToken, isCurrent: boolean): string {
  const bonded = (token.marketCap || 0) >= BONDED_MC
  const ticker = token.baseToken.symbol || token.baseToken.name || '?'
  const name = token.baseToken.name || ''
  const fallbackLetter = escapeHtml(ticker.charAt(0).toUpperCase() || '?')
  const safeTicker = escapeHtml(ticker)
  const safeName = escapeHtml(name)
  const imageUrl = safeImageUrl(token.info?.imageUrl)
  const avatar = imageUrl
    ? `<img class="psc-og-avatar" src="${escapeHtml(imageUrl)}" alt="" data-fallback="${fallbackLetter}" />`
    : `<div class="psc-og-avatar psc-og-glyph">${fallbackLetter}</div>`
  const navAttr = isCurrent ? '' : ` data-nav-path="${escapeHtml(navPathFor(token))}"`
  const itemClass = isCurrent ? 'psc-og-item psc-og-item-current' : 'psc-og-item'
  const titleSuffix = isCurrent ? ' (current)' : ''

  return `
    <div class="${itemClass}"${navAttr} title="${safeTicker} — ${safeName}${titleSuffix}">
      ${avatar}
      <span class="psc-og-ticker">${safeTicker}</span>
      <span class="psc-og-sep">–</span>
      <span class="psc-og-name">${safeName}</span>
      <span class="psc-og-sep">–</span>
      <span class="psc-og-mcap psc-og-mono">${formatCompactUsd(token.marketCap || 0)}</span>
      <span class="psc-og-sep">–</span>
      <span class="psc-og-date psc-og-mono">${formatOgDate(token.pairCreatedAt)}</span>
      ${bonded ? `<span class="psc-og-bonded" title="Bonded — mcap ≥ $60K">🎓</span>` : ''}
      ${feeIconHtml(token.feeCategory)}
      ${isCurrent ? `<span class="psc-og-current-tag">current</span>` : ''}
    </div>`
}

// Dispatched on `window` for the MAIN-world bridge (src/content/mainworld.ts)
// to pick up — content scripts run in an isolated world and can't reach
// window.next directly.
function navigateTo(path: string) {
  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { path } }))
}

function wireItemEvents(track: HTMLElement) {
  track.querySelectorAll<HTMLElement>('.psc-og-item').forEach((item) => {
    item.addEventListener('click', () => {
      const path = item.getAttribute('data-nav-path')
      if (path) navigateTo(path)
    })
  })
  track.querySelectorAll<HTMLImageElement>('img.psc-og-avatar').forEach((img) => {
    img.addEventListener('error', () => {
      const glyph = document.createElement('div')
      glyph.className = 'psc-og-avatar psc-og-glyph'
      glyph.textContent = img.dataset.fallback || '?'
      img.replaceWith(glyph)
    }, { once: true })
  })
}

// Renders the strip's content from whatever lineage data is available. The
// strip itself never collapses — it's permanently `display: flex` at
// 26.284px (see #psc-og-strip) on every page the shell exists on, so
// `null`/empty just empties the track down to background + border rather
// than hiding anything.
// `currentMint` is meta.mint for the token currently in view (see itemHtml)
// — pass null when there's nothing to compare against.
function renderStrip(tokens: SimilarToken[] | null, currentMint: string | null) {
  isLoadingStrip = false
  const strip = ensureInjected()
  if (!strip) return
  const track = strip.querySelector('.psc-og-track') as HTMLElement | null
  if (!track) return

  const lineage = (tokens || []).filter((t) => t.matchScore >= MIN_MATCH_SCORE).slice(0, MAX_ROWS)
  if (lineage.length === 0) {
    track.innerHTML = ''
    return
  }

  track.innerHTML = lineage.map((t) => itemHtml(t, t.baseToken.address === currentMint)).join('')
  wireItemEvents(track)
}

// Shown the moment a token is known (pool id resolved from the URL) but
// metadata/lineage haven't come back yet. The metadata ladder alone can run
// ~20s on a cold hard load (METADATA_RETRY_DELAYS above) — without this, the
// strip just sits invisible that whole time and a working feature reads as a
// broken one. Same fixed-height bar as real content (26.284px, see
// #psc-og-strip above) so nothing shifts when rows eventually replace the
// placeholder — only the track's contents swap, and it's deliberately
// static (no pulse/animation) so it doesn't flash or draw the eye.
function renderLoading() {
  isLoadingStrip = true
  const strip = ensureInjected()
  if (!strip) return
  const track = strip.querySelector('.psc-og-track') as HTMLElement | null
  if (!track) return
  track.innerHTML = `
    <span class="psc-og-loading-text">loading…</span>
    <div class="psc-og-skeleton" style="width: 60px;"></div>
    <div class="psc-og-skeleton" style="width: 44px;"></div>
    <div class="psc-og-skeleton" style="width: 68px;"></div>
  `
}

async function resolveMetadata(poolId: string): Promise<AxiomToken | null> {
  const immediate = tokenFromAxiomState(poolId)
  if (immediate) return immediate
  for (const delay of METADATA_RETRY_DELAYS) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    if (extractTokenFromUrl() !== poolId) return null // navigated away mid-wait — abort the ladder
    const hit = tokenFromAxiomState(poolId)
    if (hit) return hit
  }
  return null // ladder exhausted — give up silently, never falls back to a scan
}

async function fetchLineage(mint: string, name: string, symbol: string, imageUrl?: string): Promise<SimilarToken[]> {
  const cached = lineageCache.get(mint)
  if (cached) return cached
  const pending = inFlight.get(mint)
  if (pending) return pending

  const promise = fetchSimilarTokens(name, symbol, imageUrl)
    .then((res) => {
      if (lineageCache.size >= MAX_CACHE_ENTRIES && !lineageCache.has(mint)) {
        const oldestKey = lineageCache.keys().next().value
        if (oldestKey !== undefined) lineageCache.delete(oldestKey)
      }
      lineageCache.set(mint, res.tokens)
      return res.tokens
    })
    .finally(() => { inFlight.delete(mint) })
  inFlight.set(mint, promise)
  return promise
}

async function loadForCurrentToken() {
  try {
    const poolId = extractTokenFromUrl()
    // Clear the previous token's lineage immediately — showing it against the
    // new token in view would be actively misleading.
    lastTokens = null
    lastCurrentMint = null
    if (!poolId) {
      renderStrip(null, null)
      return
    }
    // Switch straight to the loading placeholder instead of leaving the
    // strip invisible while resolveMetadata's ladder runs (up to ~20s).
    renderLoading()

    const metaStart = Date.now()
    const meta = await resolveMetadata(poolId)
    console.log('[Cluster Scanner] OG strip metadata resolved in', Date.now() - metaStart, 'ms', meta ? '(hit)' : '(miss)')
    if (extractTokenFromUrl() !== poolId) return // navigated away mid-resolve
    if (!meta) {
      renderStrip(null, null)
      return
    }

    const lineageStart = Date.now()
    const tokens = await fetchLineage(meta.mint, meta.name || '', meta.symbol || '', meta.image)
    console.log('[Cluster Scanner] OG strip fetchSimilarTokens resolved in', Date.now() - lineageStart, 'ms', `(${tokens.length} rows)`)
    if (extractTokenFromUrl() !== poolId) return // navigated away mid-fetch

    lastTokens = tokens
    lastCurrentMint = meta.mint
    renderStrip(tokens, meta.mint)
  } catch {
    // Silent failure — never break Axiom.
  }
}

function scheduleLoad() {
  if (navDebounce !== null) clearTimeout(navDebounce)
  navDebounce = setTimeout(() => {
    navDebounce = null
    void loadForCurrentToken()
  }, 400)
}

// Entry point — wired into the content-script IIFE in main.ts, independent of
// the ui object createWidgetElements() returns.
export function initOgStrip() {
  try {
    ensureStyles()
    ensureInjected()
    scheduleLoad() // auto-load on page load

    let lastHref = location.href
    new MutationObserver(() => {
      try {
        if (location.href !== lastHref) {
          lastHref = location.href
          scheduleLoad() // auto-load on every SPA token navigation
          return
        }
        // Axiom's Next.js re-renders can detach our node without a URL
        // change — repair it and restore whichever state we were last in (no
        // re-fetch needed either way: real lineage is still cached, and the
        // loading placeholder needs no data at all).
        if (!stripEl || !stripEl.isConnected) {
          if (isLoadingStrip) renderLoading()
          else renderStrip(lastTokens, lastCurrentMint)
        }
      } catch {
        // Never break Axiom.
      }
    }).observe(document.body, { childList: true, subtree: true })
  } catch {
    // Never break Axiom.
  }
}
