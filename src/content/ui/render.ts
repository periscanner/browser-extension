import { formatNumber, calculatePercentage } from '../utils/format'
import { ClusterMember, SimilarToken } from '../types'
import type { InsiderCluster, InsiderMember } from '../services/api'
import { WEBAPP_URL } from '../config'

type Severity = 'danger' | 'warn' | 'low'

const SEV_COLOR: Record<Severity, string> = {
  danger: '#f43f5e',
  warn: '#f59e0b',
  low: '#71717a',
}

// Roles that indicate a wallet is a source/controller of coordination.
const ACCENT_ROLES = new Set(['hub', 'funder', 'funded', 'primary'])

// Cap rendered member rows per cluster card so a mega-cluster (200+ members)
// doesn't build hundreds of rows. The card stays scannable; the rest are summarized.
const MEMBER_ROW_CAP = 25

// Same floor as the telegram bot's /og lineage (telegram-bot/src/lib/format.ts):
// a matchScore-1 row (ticker OR name OR image alone, not two-of-three) turns up
// unrelated coins on a common word, so the default view hides it behind "Show all".
const MIN_MATCH_SCORE = 2

function clusterSeverity(supplyPct: number): Severity {
  if (supplyPct >= 20) return 'danger'
  if (supplyPct >= 8) return 'warn'
  return 'low'
}

// Insider transfer-graph data overlaid onto the cluster view: cluster members
// that RECEIVED the token by transfer get the red insider style inline, and any
// insider group not already covered by a DB cluster is shown as its own card.
export interface InsiderOverlay {
  clusters: InsiderCluster[]
  deep: boolean
}

function insiderSeverity(pct: number): Severity {
  return pct >= 5 ? 'danger' : pct >= 1 ? 'warn' : 'low'
}

// A wallet is a true insider (received the token) when it isn't the source sender.
function isReceivedInsider(m: InsiderMember | undefined): m is InsiderMember {
  return !!m && m.role !== 'source'
}

// One insider transfer-group card (source → recipients), red-styled by supply share.
function buildInsiderCard(c: InsiderCluster, totalSupply: number): string {
  const pct = totalSupply > 0 ? (c.transferredAmount / totalSupply) * 100 : 0
  const sev = insiderSeverity(pct)
  const color = SEV_COLOR[sev]
  const source = c.members.find((m) => m.role === 'source') || c.members[0]

  const rows = c.members.slice(0, MEMBER_ROW_CAP).map((m) => {
    const amt = m.role === 'source' ? m.sent : m.received
    const roleCls = m.role === 'source' ? 'cs-row-role--accent' : m.role === 'relay' ? 'cs-row-role--warn' : 'cs-row-role--insider'
    return `
      <div class="cs-row ${m.role !== 'source' ? 'cs-row--insider' : ''}">
        <span class="cs-row-addr cs-mono" data-full-address="${m.wallet}" title="Click to copy">${m.wallet.slice(0, 4)}…${m.wallet.slice(-3)}</span>
        <span class="cs-row-role ${roleCls}">${m.role}</span>
        <span class="cs-row-amount cs-mono">${formatNumber(amt)}</span>
        <span class="cs-row-supply cs-mono" style="color:${color}">${calculatePercentage(amt, totalSupply)}</span>
      </div>`
  }).join('')
  const moreRow = c.members.length > MEMBER_ROW_CAP
    ? `<div class="cs-row-more">+${c.members.length - MEMBER_ROW_CAP} more wallets in this group</div>`
    : ''

  return `
    <div class="cs-cluster cs-cluster--${sev} cs-cluster--insider">
      <div class="cs-cluster-head">
        <div class="cs-cluster-title">
          <span class="cs-cluster-sev" style="background:${color}"></span>
          <span class="cs-cluster-name cs-mono">${source.wallet.slice(0, 4)}…${source.wallet.slice(-3)} → ${c.insiderCount} insider${c.insiderCount > 1 ? 's' : ''}</span>
          <span class="cs-cluster-count cs-mono">${c.members.length}</span>
        </div>
        <div class="cs-cluster-head-right">
          <span class="cs-cluster-pct cs-mono" style="color:${color}">${pct.toFixed(1)}%</span>
          <svg class="cs-cluster-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="cs-cluster-body">
        <div class="cs-thead"><span>Wallet</span><span>Role</span><span>Amount</span><span>Supply</span></div>
        ${rows}${moreRow}
      </div>
    </div>`
}

export function renderResults(
  ui: any,
  clusters: any[],
  amountMap: Map<string, number>,
  totalSupply: number,
  insiders: InsiderOverlay | null = null,
  onDeep?: () => void,
) {
  const insiderClusters = insiders?.clusters || []
  const hasDb = clusters.length > 0

  // Nothing scanned on either axis yet → original empty state.
  if (!hasDb && !insiders) {
    ui.content.innerHTML = `<div class="cs-empty">No coordinated clusters found among top holders.</div>`
    return
  }

  // wallet → insider member, for the inline red overlay on cluster rows.
  const insiderMap = new Map<string, InsiderMember>()
  for (const ic of insiderClusters) {
    for (const m of ic.members) if (!insiderMap.has(m.wallet)) insiderMap.set(m.wallet, m)
  }

  // ---- DB clusters (with insider overlay) ----
  let cabalBar = ''
  let cards = ''
  if (hasDb) {
    const enriched = clusters.map((c: any) => {
      const pct = totalSupply > 0 ? (c.totalAmount / totalSupply) * 100 : 0
      return { ...c, pct, sev: clusterSeverity(pct) }
    })

    const totalControl = enriched.reduce((s, c) => s + c.pct, 0)
    // > 5% red, > 3% yellow, otherwise the default text colour.
    const controlClass = totalControl > 5 ? 'is-danger' : totalControl > 3 ? 'is-warn' : ''

    cabalBar = `
      <div class="cs-cabal">
        <div class="cs-cabal-head">
          <span class="cs-cabal-label">Total cluster control of supply</span>
          <span class="cs-cabal-value cs-mono ${controlClass}">${totalControl.toFixed(1)}%</span>
        </div>
        <div class="cs-cabal-track">
          ${enriched.map((c) => `<div class="cs-cabal-seg" style="width:${Math.min(c.pct, 100)}%;background:${SEV_COLOR[c.sev as Severity]}"></div>`).join('')}
        </div>
      </div>
    `

    cards = enriched.map((c: any) => {
      const sev = c.sev as Severity
      const supplyColor = sev === 'danger' ? 'color:#f43f5e' : sev === 'warn' ? 'color:#f59e0b' : 'color:#a1a1aa'
      const insiderN = c.members.filter((m: ClusterMember) => isReceivedInsider(insiderMap.get(m.wallet_address))).length
      const insiderBadge = insiderN
        ? `<span class="cs-cluster-insider-badge">⚠ ${insiderN} insider${insiderN > 1 ? 's' : ''}</span>`
        : ''
      const rows = c.members.slice(0, MEMBER_ROW_CAP).map((m: ClusterMember) => {
        const amount = amountMap.get(m.wallet_address) || 0
        const role = (m.role || '').toLowerCase()
        const ins = insiderMap.get(m.wallet_address)
        const received = isReceivedInsider(ins)
        const roleClass = received
          ? 'cs-row-role--insider'
          : ACCENT_ROLES.has(role) ? (sev === 'warn' ? 'cs-row-role--warn' : 'cs-row-role--accent') : ''
        const roleLabel = received ? ins!.role : (m.role || 'member')
        return `
          <div class="cs-row ${received ? 'cs-row--insider' : ''}">
            <span class="cs-row-addr cs-mono" data-full-address="${m.wallet_address}" title="Click to copy">${m.wallet_address.slice(0, 4)}…${m.wallet_address.slice(-3)}</span>
            <span class="cs-row-role ${roleClass}">${roleLabel}</span>
            <span class="cs-row-amount cs-mono">${formatNumber(amount)}</span>
            <span class="cs-row-supply cs-mono" style="${supplyColor}">${calculatePercentage(amount, totalSupply)}</span>
          </div>
        `
      }).join('')
      const moreRow = c.members.length > MEMBER_ROW_CAP
        ? `<div class="cs-row-more">+${c.members.length - MEMBER_ROW_CAP} more holders in this cluster</div>`
        : ''

      return `
        <div class="cs-cluster cs-cluster--${sev}">
          <div class="cs-cluster-head">
            <div class="cs-cluster-title">
              <span class="cs-cluster-sev" style="background:${SEV_COLOR[sev]}"></span>
              <a href="${WEBAPP_URL}/cluster/${c.cluster_id}" target="_blank" class="cs-cluster-name">${c.cluster_name || 'Unnamed cluster'}</a>
              <span class="cs-cluster-count cs-mono">${c.members.length}</span>
              ${insiderBadge}
            </div>
            <div class="cs-cluster-head-right">
              <span class="cs-cluster-pct cs-mono" style="color:${SEV_COLOR[sev]}">${c.pct.toFixed(1)}%</span>
              <svg class="cs-cluster-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
          <div class="cs-cluster-body">
            <div class="cs-thead"><span>Wallet</span><span>Role</span><span>Amount</span><span>Supply</span></div>
            ${rows}${moreRow}
          </div>
        </div>
      `
    }).join('')
  }

  // ---- Insider transfer groups (standalone section) ----
  let insiderSection = ''
  if (insiders) {
    const dbWallets = new Set<string>()
    clusters.forEach((c: any) => c.members.forEach((m: ClusterMember) => dbWallets.add(m.wallet_address)))
    // Groups with at least one recipient not already shown inside a DB cluster
    // (the rest are already flagged red inline by the overlay above).
    const standalone = insiderClusters.filter((ic) =>
      ic.members.some((m) => m.role !== 'source' && !dbWallets.has(m.wallet))
    )
    const control = insiders.deep
      ? `<span class="cs-insider-badge">Multi-hop · deep</span>`
      : `<button id="cs-insider-deep" class="cs-insider-deep">Multi-hop deep ⤵</button>`
    const body = standalone.length
      ? standalone.map((c) => buildInsiderCard(c, totalSupply)).join('')
      : `<div class="cs-empty" style="padding:14px">${insiderClusters.length
          ? 'All insider wallets are flagged in the clusters above.'
          : 'No insider transfers among top holders — they bought on-market.'}${insiders.deep ? '' : '<br>Try a multi-hop deep scan for indirect chains.'}</div>`
    insiderSection = `
      <div class="cs-section">
        <div class="cs-section-head">
          <span class="cs-section-label">Insider transfers${standalone.length ? ` · ${standalone.length}` : ''}</span>
          ${control}
        </div>
        ${body}
      </div>`
  }

  ui.content.innerHTML = (hasDb ? cabalBar + cards : '') + insiderSection

  // Accordion: each card starts collapsed; clicking the header toggles it.
  ui.content.querySelectorAll('.cs-cluster-head').forEach((head: HTMLElement) => {
    head.addEventListener('click', () => head.parentElement?.classList.toggle('is-open'))
  })
  // Clicking a cluster name link opens its page — don't also toggle the card.
  ui.content.querySelectorAll('a.cs-cluster-name').forEach((link: Element) => {
    link.addEventListener('click', (e: Event) => e.stopPropagation())
  })
  // Click-to-copy wallet addresses (covers DB and insider cards).
  ui.content.querySelectorAll('.cs-row-addr').forEach((el: HTMLElement) => {
    el.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      const address = (e.currentTarget as HTMLElement).getAttribute('data-full-address')
      if (address) {
        try { await navigator.clipboard.writeText(address); showToast('Wallet copied') }
        catch (err) { console.error('Failed to copy', err) }
      }
    })
  })
  // Upgrade to the multi-hop deep insider scan.
  const deepBtn = ui.content.querySelector('#cs-insider-deep') as HTMLButtonElement | null
  if (deepBtn && onDeep) deepBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); onDeep() })
}

function ageString(pairCreatedAt?: number): string {
  // pairCreatedAt is already epoch ms (DexScreener's native format, passed
  // through as-is by scanner-api) — no *1000 here.
  if (!pairCreatedAt) return '—'
  const ms = Date.now() - pairCreatedAt
  if (ms < 0) return 'new'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// Exact first-pool date — same format and value as the bot's "DATE (UTC)"
// column (telegram-bot/src/lib/format.ts formatDate). A token whose date is
// unknown (no pool carries a valid pairCreatedAt) renders "?", same as the bot.
// A "~" prefix means scanner-api dated the row from the mint's on-chain
// creation because DexScreener has no pool date for it — same marker and same
// meaning as the bot's column, so the two surfaces read alike.
function formatExactDate(token: SimilarToken): string {
  const marker = token.pairCreatedAtSource === 'mint' ? '~' : ''
  if (!token.pairCreatedAt) return `${marker}?`
  const d = new Date(token.pairCreatedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${marker}${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}

export interface SimilarTokensOptions {
  /** The token currently being scanned — marks its own row, if present in the list. */
  scannedMint?: string | null
  /** Mirrors /og's `[ Show all ]` toggle: filtered (matchScore >= 2) by default. */
  showAll: boolean
  /** Wired to the "Show all" / "Show filtered only" button, when there's anything to toggle. */
  onToggleShowAll?: () => void
}

function similarRowHtml(token: SimilarToken, rank: number, crowned: boolean, isYou: boolean): string {
  const highRisk = token.matchScore === 3
  const isBonded = token.marketCap >= 60000

  const avatar = token.info?.imageUrl
    ? `<img src="${token.info.imageUrl}" alt="" class="cs-sim-avatar" />`
    : `<div class="cs-sim-avatar cs-sim-glyph">◎</div>`

  const marketCap = token.marketCap
    ? `$${token.marketCap >= 1e6 ? (token.marketCap / 1e6).toFixed(1) + 'M' : (token.marketCap / 1e3).toFixed(0) + 'k'}`
    : 'N/A'

  const badge = highRisk
    ? `<span class="cs-sim-badge cs-sim-badge--danger">High match</span>`
    : isBonded
      ? `<span class="cs-sim-badge cs-sim-badge--safe">Bonded</span>`
      : ''

  const chip = (on: boolean | undefined, label: string) =>
    `<span class="cs-sim-chip ${on ? 'on' : ''}">${label}</span>`

  const rowClass = highRisk ? 'cs-sim cs-sim--danger' : (token.matchScore === 2 ? 'cs-sim cs-sim--warn' : 'cs-sim')

  return `
    <div class="${rowClass}" data-axiom-link="${token.axiomLink}">
      <span class="cs-sim-rank ${crowned ? 'cs-sim-rank--og' : ''}" title="${crowned ? 'OG token — oldest bonded match' : `Rank ${rank}, oldest first`}">${crowned ? '👑' : ''}${rank}</span>
      ${avatar}
      <div class="cs-sim-main">
        <div class="cs-sim-top">
          <span class="cs-sim-name">${token.baseToken.symbol || token.baseToken.name}</span>
          ${isYou ? '<span class="cs-sim-you">◀ you</span>' : ''}
          ${badge}
        </div>
        <div class="cs-sim-meta cs-mono">
          <span>${marketCap}</span>
          <span class="dot"></span>
          <span>${ageString(token.pairCreatedAt)}</span>
        </div>
        <div class="cs-sim-date cs-mono" title="${token.pairCreatedAtSource === 'mint' ? 'Mint creation date — DexScreener has no pool date for this token' : 'First pool date'}">${formatExactDate(token)}</div>
      </div>
      <div class="cs-sim-matches">
        ${chip(token.match.ticker, 'T')}
        ${chip(token.match.name, 'N')}
        ${chip(token.match.image, 'I')}
      </div>
      <button class="cs-sim-copy" data-full-address="${token.baseToken.address}" title="Copy address">⧉</button>
    </div>
  `
}

/**
 * Same lineage shape as the bot's /og: oldest-first (scanner-api's native
 * order), matchScore>=2 by default with a "Show all N" toggle behind a
 * hidden-count footer, the oldest *bonded* row in what's rendered crowned 👑,
 * and the scanned token's own row (if present) marked ◀you. No row cap —
 * unlike a Telegram message, this panel scrolls.
 */
export function renderSimilarTokens(
  ui: any,
  tokens: SimilarToken[],
  opts: SimilarTokensOptions
) {
  if (tokens.length === 0) {
    ui.similarContent.innerHTML = `<div class="cs-empty">No similar tokens found.</div>`
    return
  }

  const strong = tokens.filter((t) => t.matchScore >= MIN_MATCH_SCORE)
  const hiddenCount = tokens.length - strong.length
  const rows = opts.showAll ? tokens : strong

  // Oldest bonded row *among what's rendered* — matches /og's findOgTokenIndex:
  // deliberately scoped to the filtered/show-all view on screen, not the raw list.
  const ogIndex = rows.findIndex((t) => t.marketCap >= 60000)

  const note = `<div class="cs-sim-note">${tokens.length} token${tokens.length === 1 ? '' : 's'} sharing this name, ticker or image — possible copycats or relaunches.</div>`

  const body = rows.length > 0
    ? rows.map((token, i) => similarRowHtml(
        token,
        i + 1,
        i === ogIndex,
        !!opts.scannedMint && token.baseToken.address === opts.scannedMint
      )).join('')
    : `<div class="cs-empty">No strong (2+ signal) matches — ${hiddenCount} ticker-only match${hiddenCount === 1 ? '' : 'es'} hidden.</div>`

  const footer = hiddenCount > 0
    ? `<div class="cs-sim-footer">
        <span>${hiddenCount} ticker-only match${hiddenCount === 1 ? '' : 'es'} hidden</span>
        <button id="cs-sim-toggle" class="cs-sim-toggle">${opts.showAll ? 'Show filtered only' : `Show all ${tokens.length}`}</button>
      </div>`
    : ''

  ui.similarContent.innerHTML = note + body + footer

  // Row click opens the token's Axiom page — except when the click landed on
  // the copy button, which stops propagation below instead.
  ui.similarContent.querySelectorAll('.cs-sim').forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      const href = el.getAttribute('data-axiom-link')
      if (href) window.open(href, '_blank', 'noopener')
    })
  })
  ui.similarContent.querySelectorAll('.cs-sim-copy').forEach((btn: HTMLElement) => {
    btn.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      const address = btn.getAttribute('data-full-address')
      if (!address) return
      try { await navigator.clipboard.writeText(address); showToast('Address copied') }
      catch (err) { console.error('Failed to copy', err) }
    })
  })
  const toggleBtn = ui.similarContent.querySelector('#cs-sim-toggle') as HTMLButtonElement | null
  if (toggleBtn && opts.onToggleShowAll) {
    toggleBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); opts.onToggleShowAll!() })
  }
}

function showToast(message: string) {
  const existingToast = document.querySelector('.cs-toast')
  if (existingToast) existingToast.remove()

  const toast = document.createElement('div')
  toast.className = 'cs-toast'
  toast.textContent = message
  document.body.appendChild(toast)

  void toast.offsetWidth // force reflow
  toast.classList.add('visible')

  setTimeout(() => {
    toast.classList.remove('visible')
    setTimeout(() => { if (toast.parentNode) toast.remove() }, 300)
  }, 2500)
}
