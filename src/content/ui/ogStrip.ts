// OG lineage strip — a compact horizontal row of up to 5 relaunch/copycat
// tokens (matchScore >= 2, oldest-first per the API), injected directly into
// Axiom's own page chrome so you can jump between relaunches without opening
// the Periscanner panel. Lives OUTSIDE #cluster-scanner-widget and is fully
// decoupled from the panel's scan/reset lifecycle — it works with the panel
// closed and never calls runScan or any Helius-backed endpoint.
//
// Never throws into the page: every entry point is wrapped so a failure here
// silently does nothing rather than breaking Axiom.

import { extractTokenFromUrl } from '../services/scanner'
import { lookupByUrlId } from '../services/tokenLookup'
import { formatCompactUsd } from '../utils/format'
import { escapeHtml, safeImageUrl } from '../utils/escape'
import { imageCandidates } from '../utils/imageSources'
import { getCachedQuote, loadQuotes, quoteLabel } from '../services/quotePairs'
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

// The token in view. `urlId` is whatever the page URL carries (a mint on
// /token/<mint>, a pool on legacy /meme/<pool>); `mint` is the canonical mint the
// backend resolved it to (null when it didn't say). A row is current if it
// matches EITHER, so a missing/older `searchedToken.mint` or a pool-id URL can
// no longer drop the highlight. name/symbol/imageUrl let a row be shown for
// the current token when the API's lineage omitted it.
interface CurrentToken {
  urlId: string
  mint: string | null
  name?: string
  symbol?: string
  imageUrl?: string
}

let stripEl: HTMLElement | null = null
let lastTokens: SimilarToken[] | null = null
// Who is "current" for lastTokens — kept alongside it so the detach-repair path in
// initOgStrip can re-render the "current row" highlight without re-fetching.
let lastCurrent: CurrentToken | null = null
// True while the strip is showing the loading placeholder rather than real
// content — lets the detach-repair path restore the right one of the two.
let isLoadingStrip = false
let navDebounce: ReturnType<typeof setTimeout> | null = null

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
    /* pump.fun charity coin: compact heart right after the ticker. Inline SVG
       (not Axiom's icon font) so it renders the same wherever the strip does. */
    #psc-og-strip .psc-og-charity {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      width: 11px;
      height: 11px;
      margin-left: -3px;
      color: #f472b6;
    }
    #psc-og-strip .psc-og-charity svg { width: 100%; height: 100%; display: block; }
    /* pump.fun "Holder rewards" coin: gift icon next to where the charity heart
       goes (a coin is never both). Inline stroke SVG, same sizing as the heart. */
    #psc-og-strip .psc-og-holder-rewards {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      width: 11px;
      height: 11px;
      margin-left: -3px;
      color: #facc15;
    }
    #psc-og-strip .psc-og-holder-rewards svg { width: 100%; height: 100%; display: block; }
    /* Stock-paired coin whose creator (dev) fee goes to the dev wallet: red chef
       hat right after the "/AAPL" quote badge. Slightly larger than the other
       row icons on purpose (user-requested: must be easy to spot). */
    #psc-og-strip .psc-og-dev-fee {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      color: #ef4444;
    }
    #psc-og-strip .psc-og-dev-fee svg { width: 100%; height: 100%; display: block; }
    #psc-og-strip .psc-og-quote {
      font-size: 9px;
      font-weight: 600;
      color: #f4c06b;
      margin-left: -3px;
      max-width: 72px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #psc-og-strip .psc-og-quote:empty { display: none; }
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
export function ensureInjected(): HTMLElement | null {
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

// Built from the row's mint, not the backend's axiomLink, so it does not
// depend on the link shape of whichever API version is deployed. Axiom's
// current token URL is /token/<mint>?chain=sol. The mint comes from the API
// (attacker-influenced), so it is only used when it is a plain base58 id;
// the result is a same-origin relative path, since it is later handed to
// window.location.href by the MAIN-world bridge (mainworld.ts).
const BASE58_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
function navPathFor(token: SimilarToken): string | null {
  const mint = token.baseToken.address
  return BASE58_MINT.test(mint) ? `/token/${mint}?chain=sol` : null
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

// pump.fun charity-coin heart. `isCharity` comes from the API (attacker-
// influenced surface like everything else on the row), so only the boolean
// `true` renders it, and the markup is a hardcoded literal with nothing
// interpolated. Anything else (missing, "true", 1, objects) shows nothing.
const CHARITY_HEART =
  '<span class="psc-og-charity" title="Charity coin: creator fees go to charity (Donate.gg)">' +
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></span>'
function charityHtml(isCharity: SimilarToken['isCharity']): string {
  return isCharity === true ? CHARITY_HEART : ''
}

// pump.fun "Holder rewards" coin (creator fees paid out to holders). Same
// strict `=== true` gate and hardcoded markup as the heart. The glyph is a
// lucide-style gift: pump.fun's own icon isn't reachable (challenge-locked).
const HOLDER_REWARDS_ICON =
  '<span class="psc-og-holder-rewards" title="Holder rewards">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg></span>'
function holderRewardsHtml(isHolderRewards: SimilarToken['isHolderRewards']): string {
  return isHolderRewards === true ? HOLDER_REWARDS_ICON : ''
}

// Stock-paired coin whose creator fee goes to the dev wallet (isDevFeeStock).
// Same strict `=== true` gate and hardcoded markup as the other row icons; the
// glyph is lucide's chef-hat. Tooltip is static: the exact fee rate is not
// sent by the API.
const DEV_FEE_CHEF =
  '<span class="psc-og-dev-fee" title="Dev earns a creator fee on this stock-paired coin">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg></span>'
function devFeeHtml(isDevFeeStock: SimilarToken['isDevFeeStock']): string {
  return isDevFeeStock === true ? DEV_FEE_CHEF : ''
}

// `isCurrent` marks the row for the token already open in this tab (see isCurrentRow:
// matched by canonical mint, URL id or pool address, since
// the URL id may be a pool while rows carry mints). That row gets
// accent styling and, critically, no data-nav-path attribute at all, so
// wireItemEvents' `if (path)` guard turns its click into a no-op instead of a
// navigation back to the page already showing (verified live: previously it
// pointed at itself and felt broken).
function itemHtml(token: SimilarToken, isCurrent: boolean): string {
  const bonded = (token.marketCap || 0) >= BONDED_MC && !placeholderRows.has(token)
  const ticker = token.baseToken.symbol || token.baseToken.name || '?'
  const name = token.baseToken.name || ''
  const fallbackLetter = escapeHtml(ticker.charAt(0).toUpperCase() || '?')
  const safeTicker = escapeHtml(ticker)
  const safeName = escapeHtml(name)
  // First candidate is the <img src>; the rest are tried by wireItemEvents on
  // error before the glyph (see ../utils/imageSources for why).
  const [imageUrl, ...altImages] = imageCandidates(token.info?.imageUrl, token.baseToken.address)
  const avatar = imageUrl
    ? `<img class="psc-og-avatar" src="${escapeHtml(imageUrl)}" alt="" referrerpolicy="no-referrer" data-alts="${escapeHtml(JSON.stringify(altImages))}" data-fallback="${fallbackLetter}" />`
    : `<div class="psc-og-avatar psc-og-glyph">${fallbackLetter}</div>`
  const mint = BASE58_MINT.test(token.baseToken.address) ? token.baseToken.address : null
  const quote = quoteLabel(token.quoteToken ?? (mint ? getCachedQuote(mint) : null))
  const navPath = isCurrent ? null : navPathFor(token)
  const navAttr = navPath ? ` data-nav-path="${escapeHtml(navPath)}"` : ''
  const itemClass = isCurrent ? 'psc-og-item psc-og-item-current' : 'psc-og-item'
  const titleSuffix = isCurrent ? ' (current)' : ''

  return `
    <div class="${itemClass}"${navAttr}${mint ? ` data-mint="${escapeHtml(mint)}"` : ''} title="${safeTicker} — ${safeName}${titleSuffix}">
      ${avatar}
      <span class="psc-og-ticker">${safeTicker}</span>
      ${charityHtml(token.isCharity)}${holderRewardsHtml(token.isHolderRewards)}
      <span class="psc-og-quote"${quote ? ` title="Paired against ${escapeHtml(quote)}"` : ''}>${quote ? '/' + escapeHtml(quote) : ''}</span>
      ${devFeeHtml(token.isDevFeeStock)}
      <span class="psc-og-sep">–</span>
      <span class="psc-og-name">${safeName}</span>
      ${placeholderRows.has(token) || token.marketCap == null ? '' : `<span class="psc-og-sep">–</span>
      <span class="psc-og-mcap psc-og-mono">${formatCompactUsd(token.marketCap)}</span>`}
      ${placeholderRows.has(token) || !token.pairCreatedAt ? '' : `<span class="psc-og-sep">–</span>
      <span class="psc-og-date psc-og-mono">${formatOgDate(token.pairCreatedAt)}</span>`}
      ${bonded ? `<span class="psc-og-bonded" title="Bonded — mcap ≥ $60K">🎓</span>` : ''}
      ${feeIconHtml(token.feeCategory)}
      ${isCurrent ? `<span class="psc-og-current-tag">current</span>` : ''}
    </div>`
}

// Dispatched on `window` for the MAIN-world bridge (src/content/mainworld.ts)
// to pick up (it does the navigation in the page's own world).
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
    // Walk the remaining candidates one by one; only when all have failed
    // does the letter glyph replace the image. Each candidate is re-validated
    // (it round-trips through a DOM attribute) before it becomes a src.
    img.addEventListener('error', function onError() {
      const next = nextImageAlt(img)
      if (next) {
        img.src = next
        return
      }
      img.removeEventListener('error', onError)
      const glyph = document.createElement('div')
      glyph.className = 'psc-og-avatar psc-og-glyph'
      glyph.textContent = img.dataset.fallback || '?'
      img.replaceWith(glyph)
    })
  })
}

function nextImageAlt(img: HTMLImageElement): string | null {
  let alts: unknown
  try { alts = JSON.parse(img.dataset.alts || '[]') } catch { alts = [] }
  const list = Array.isArray(alts) ? alts.filter((u): u is string => typeof u === 'string') : []
  while (list.length) {
    const next = safeImageUrl(list.shift())
    if (next) {
      img.dataset.alts = JSON.stringify(list)
      return next
    }
  }
  img.dataset.alts = '[]'
  return null
}

// Fills the "/TTWO" quote badge on rows once DexScreener answers. A no-op for
// rows that already got one (cached, or supplied by the API) and for SOL pairs.
function applyQuotes(track: HTMLElement) {
  track.querySelectorAll<HTMLElement>('.psc-og-item[data-mint]').forEach((item) => {
    const slot = item.querySelector<HTMLElement>('.psc-og-quote')
    const label = quoteLabel(getCachedQuote(item.dataset.mint!))
    if (!slot || !label || slot.textContent) return
    slot.textContent = '/' + label
    slot.title = `Paired against ${label}`
  })
}

// Renders the strip's content from whatever lineage data is available. The
// strip itself never collapses — it's permanently `display: flex` at
// 26.284px (see #psc-og-strip) on every page the shell exists on, so
// `null`/empty just empties the track down to background + border rather
// than hiding anything.
// `currentMint` is the canonical mint of the token currently in view (see itemHtml)
// — pass null when there's nothing to compare against.
function isCurrentRow(t: SimilarToken, cur: CurrentToken | null): boolean {
  if (!cur) return false
  const a = t.baseToken.address
  return a === cur.urlId || (cur.mint !== null && a === cur.mint) || t.pairAddress === cur.urlId
}

// Rows with no market data (the current token synthesized from lookup metadata
// when the API's lineage left it out) skip the mcap/date columns instead of
// showing a misleading "$0 – ?".
const placeholderRows = new WeakSet<SimilarToken>()

function placeholderFor(cur: CurrentToken): SimilarToken {
  const t: SimilarToken = {
    chainId: 'solana', dexId: '', pairAddress: cur.urlId,
    baseToken: { address: cur.mint!, name: cur.name || '', symbol: cur.symbol || '' },
    priceUsd: '0', liquidity: { usd: 0 }, fdv: 0, marketCap: 0, pairCreatedAt: 0,
    info: { imageUrl: cur.imageUrl || '' },
    match: { ticker: true, name: true, image: true }, matchScore: 3, axiomLink: '', bonded: false,
  } as SimilarToken
  placeholderRows.add(t)
  return t
}

// Which rows to show, and which of them is the current token. The current row is
// ALWAYS shown when the lineage knows it: it bypasses the matchScore floor and is
// swapped in for the last slot when it would fall past MAX_ROWS (newer relaunches
// sort last, and they are the ones people are looking at). When the API left it
// out entirely but other lineage rows exist, it is added from the lookup's own
// metadata so the strip still says "you are here".
function pickRows(tokens: SimilarToken[], cur: CurrentToken | null): { rows: SimilarToken[]; current: SimilarToken | null } {
  const currentRow = tokens.find((t) => isCurrentRow(t, cur)) ?? null
  const eligible = tokens.filter((t) => t.matchScore >= MIN_MATCH_SCORE || t === currentRow)
  let rows = eligible.slice(0, MAX_ROWS)
  if (currentRow && !rows.includes(currentRow)) rows = [...eligible.slice(0, MAX_ROWS - 1), currentRow]
  let current = currentRow
  if (!current && cur?.mint && (cur.name || cur.symbol) && rows.length > 0) {
    current = placeholderFor(cur)
    rows = [...rows.slice(0, MAX_ROWS - 1), current]
  }
  return { rows, current }
}

// Renders the strip's content from whatever lineage data is available. The
// strip itself never collapses — it's permanently `display: flex` at
// 26.284px (see #psc-og-strip) on every page the shell exists on, so
// `null`/empty just empties the track down to background + border rather
// than hiding anything.
// `cur` identifies the token currently in view (see itemHtml) — null when there's
// nothing to compare against.
function renderStrip(tokens: SimilarToken[] | null, cur: CurrentToken | null) {
  isLoadingStrip = false
  const strip = ensureInjected()
  if (!strip) return
  const track = strip.querySelector('.psc-og-track') as HTMLElement | null
  if (!track) return

  const { rows: lineage, current } = pickRows(tokens || [], cur)
  if (lineage.length === 0) {
    track.innerHTML = ''
    return
  }

  track.innerHTML = lineage.map((t) => itemHtml(t, t === current)).join('')
  wireItemEvents(track)

  // Quote pairing isn't in the API rows: one batched lookup, badges fill in
  // when it lands (cached mints already rendered theirs above).
  const unknown = lineage
    .filter((t) => !t.quoteToken && getCachedQuote(t.baseToken.address) === undefined)
    .map((t) => t.baseToken.address)
  if (unknown.length) void loadQuotes(unknown).then(() => { if (track.isConnected) applyQuotes(track) }).catch(() => {})
}

// Shown the moment a token id is read from the URL but its lineage hasn't
// come back yet — without it the strip sits invisible during the fetch and a
// working feature reads as a broken one. Same fixed-height bar as real content (26.284px, see
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

async function loadForCurrentToken() {
  try {
    const urlId = extractTokenFromUrl()
    // Clear the previous token's lineage immediately — showing it against the
    // new token in view would be actively misleading. Except when the strip
    // already shows this very token (moved there by showKnownRow below): keep
    // those rows up while the fresh lineage loads instead of flashing a
    // loading placeholder.
    const keepRows = !!urlId && lastCurrent?.urlId === urlId && lastTokens !== null
    if (!keepRows) {
      lastTokens = null
      lastCurrent = null
    }
    if (!urlId) {
      renderStrip(null, null)
      return
    }
    if (!keepRows) renderLoading()

    const start = Date.now()
    const lineage = await lookupByUrlId(urlId).catch(() => null)
    console.log('[Cluster Scanner] OG strip lineage resolved in', Date.now() - start, 'ms', lineage ? `(${lineage.tokens.length} rows)` : '(miss)')
    if (extractTokenFromUrl() !== urlId) return // navigated away mid-fetch

    if (!lineage) {
      if (keepRows) return // the rows already on screen are for this token
      renderStrip(null, null)
      return
    }
    lastTokens = lineage.tokens
    lastCurrent = { urlId, mint: lineage.mint, name: lineage.name, symbol: lineage.symbol, imageUrl: lineage.imageUrl }
    renderStrip(lastTokens, lastCurrent)
  } catch {
    // Silent failure — never break Axiom.
  }
}

// SPA navigation to a token that is already a row in the strip (Axiom's own
// links between relaunches): move the highlight right away, before the
// debounced lookup, so it never lags behind or points at the previous token.
function showKnownRow() {
  const id = extractTokenFromUrl()
  if (!id || !lastTokens || !lastCurrent || lastCurrent.urlId === id) return
  const hit = lastTokens.find((t) => t.baseToken.address === id || t.pairAddress === id)
  if (!hit) return
  lastCurrent = { urlId: id, mint: hit.baseToken.address, name: hit.baseToken.name, symbol: hit.baseToken.symbol, imageUrl: hit.info?.imageUrl }
  renderStrip(lastTokens, lastCurrent)
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
          showKnownRow()
          scheduleLoad() // auto-load on every SPA token navigation
          return
        }
        // Axiom's Next.js re-renders can detach our node without a URL
        // change — repair it and restore whichever state we were last in (no
        // re-fetch needed either way: real lineage is still cached, and the
        // loading placeholder needs no data at all).
        if (!stripEl || !stripEl.isConnected) {
          if (isLoadingStrip) renderLoading()
          else renderStrip(lastTokens, lastCurrent)
        }
      } catch {
        // Never break Axiom.
      }
    }).observe(document.body, { childList: true, subtree: true })
  } catch {
    // Never break Axiom.
  }
}
