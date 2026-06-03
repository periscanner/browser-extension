import { formatNumber, calculatePercentage } from '../utils/format'
import { ClusterMember, SimilarToken } from '../types'
import type { InsiderCluster } from '../services/api'
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

function clusterSeverity(supplyPct: number): Severity {
  if (supplyPct >= 20) return 'danger'
  if (supplyPct >= 8) return 'warn'
  return 'low'
}

export function renderResults(
  ui: any,
  clusters: any[],
  amountMap: Map<string, number>,
  totalSupply: number
) {
  if (clusters.length === 0) {
    ui.content.innerHTML = `<div class="cs-empty">No coordinated clusters found among top holders.</div>`
    return
  }

  // Per-cluster supply share + severity.
  const enriched = clusters.map((c: any) => {
    const pct = totalSupply > 0 ? (c.totalAmount / totalSupply) * 100 : 0
    return { ...c, pct, sev: clusterSeverity(pct) }
  })

  const totalControl = enriched.reduce((s, c) => s + c.pct, 0)
  // > 5% red, > 3% yellow, otherwise the default text colour.
  const controlClass = totalControl > 5 ? 'is-danger' : totalControl > 3 ? 'is-warn' : ''

  const cabalBar = `
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

  const cards = enriched.map((c: any) => {
    const sev = c.sev as Severity
    const supplyColor = sev === 'danger' ? 'color:#f43f5e' : sev === 'warn' ? 'color:#f59e0b' : 'color:#a1a1aa'
    const rows = c.members.slice(0, MEMBER_ROW_CAP).map((m: ClusterMember) => {
      const amount = amountMap.get(m.wallet_address) || 0
      const role = (m.role || '').toLowerCase()
      const roleClass = ACCENT_ROLES.has(role)
        ? (sev === 'warn' ? 'cs-row-role--warn' : 'cs-row-role--accent')
        : ''
      return `
        <div class="cs-row">
          <span class="cs-row-addr cs-mono" data-full-address="${m.wallet_address}" title="Click to copy">${m.wallet_address.slice(0, 4)}…${m.wallet_address.slice(-3)}</span>
          <span class="cs-row-role ${roleClass}">${m.role || 'member'}</span>
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

  ui.content.innerHTML = cabalBar + cards

  // Accordion: each cluster starts collapsed; clicking the header toggles it.
  ui.content.querySelectorAll('.cs-cluster-head').forEach((head: HTMLElement) => {
    head.addEventListener('click', () => {
      head.parentElement?.classList.toggle('is-open')
    })
  })
  // Clicking the cluster name opens its full page — don't also toggle the card.
  ui.content.querySelectorAll('.cs-cluster-name').forEach((link: Element) => {
    link.addEventListener('click', (e: Event) => e.stopPropagation())
  })

  // Click-to-copy wallet addresses.
  const addrs = ui.content.querySelectorAll('.cs-row-addr')
  addrs.forEach((el: HTMLElement) => {
    el.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      const address = (e.currentTarget as HTMLElement).getAttribute('data-full-address')
      if (address) {
        try {
          await navigator.clipboard.writeText(address)
          showToast('Wallet copied')
        } catch (err) {
          console.error('Failed to copy', err)
        }
      }
    })
  })
}

function ageString(pairCreatedAt?: number): string {
  if (!pairCreatedAt) return '—'
  const ms = Date.now() - pairCreatedAt * 1000
  if (ms < 0) return 'new'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const INSIDER_SEV_COLOR = { danger: '#f43f5e', warn: '#f59e0b', low: '#71717a' }

export function renderInsiders(ui: any, clusters: InsiderCluster[], totalSupply: number, deep = false) {
  // Control bar: offer the multi-hop deep scan (or show it's already deep).
  const control = deep
    ? `<div class="cs-insider-bar"><span class="cs-insider-badge">Multi-hop · deep</span></div>`
    : `<div class="cs-insider-bar"><button id="cs-insider-deep" class="cs-insider-deep">Multi-hop deep scan ⤵</button></div>`

  if (!clusters.length) {
    ui.insiderContent.innerHTML = control +
      `<div class="cs-empty">No insider transfers among top holders — they bought on-market, not received.${deep ? '' : '<br>Try a multi-hop deep scan to follow indirect chains.'}</div>`
    return
  }

  const totalPct = clusters.reduce((s, c) => s + (totalSupply > 0 ? (c.transferredAmount / totalSupply) * 100 : 0), 0)
  const headCls = totalPct > 5 ? 'is-danger' : totalPct > 1 ? 'is-warn' : ''
  const summary = `
    <div class="cs-cabal">
      <div class="cs-cabal-head">
        <span class="cs-cabal-label">${clusters.length} insider group${clusters.length > 1 ? 's' : ''} · supply received by transfer</span>
        <span class="cs-cabal-value cs-mono ${headCls}">${totalPct.toFixed(1)}%</span>
      </div>
    </div>`

  const cards = clusters.map((c) => {
    const pct = totalSupply > 0 ? (c.transferredAmount / totalSupply) * 100 : 0
    const sev = (pct >= 5 ? 'danger' : pct >= 1 ? 'warn' : 'low') as keyof typeof INSIDER_SEV_COLOR
    const color = INSIDER_SEV_COLOR[sev]
    const source = c.members.find((m) => m.role !== 'insider') || c.members[0]

    const rows = c.members.slice(0, MEMBER_ROW_CAP).map((m) => {
      const amt = m.role === 'source' ? m.sent : m.received
      const roleCls = m.role === 'source' ? 'cs-row-role--accent' : m.role === 'relay' ? 'cs-row-role--warn' : ''
      return `
        <div class="cs-row">
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
      <div class="cs-cluster cs-cluster--${sev}">
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
  }).join('')

  ui.insiderContent.innerHTML = control + summary + cards

  ui.insiderContent.querySelectorAll('.cs-cluster-head').forEach((head: HTMLElement) => {
    head.addEventListener('click', () => head.parentElement?.classList.toggle('is-open'))
  })
  ui.insiderContent.querySelectorAll('.cs-row-addr').forEach((el: HTMLElement) => {
    el.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      const a = (e.currentTarget as HTMLElement).getAttribute('data-full-address')
      if (a) { try { await navigator.clipboard.writeText(a); showToast('Wallet copied') } catch { /* ignore */ } }
    })
  })
}

export function renderSimilarTokens(
  ui: any,
  tokens: SimilarToken[]
) {
  if (tokens.length === 0) {
    ui.similarContent.innerHTML = `<div class="cs-empty">No similar tokens found.</div>`
    return
  }

  const note = `<div class="cs-sim-note">${tokens.length} token${tokens.length === 1 ? '' : 's'} sharing this name, ticker or image — possible copycats or relaunches.</div>`

  const rows = tokens.map((token) => {
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
      <a href="${token.axiomLink}" target="_blank" class="${rowClass}">
        ${avatar}
        <div class="cs-sim-main">
          <div class="cs-sim-top">
            <span class="cs-sim-name">${token.baseToken.symbol || token.baseToken.name}</span>
            ${badge}
          </div>
          <div class="cs-sim-meta cs-mono">
            <span>${marketCap}</span>
            <span class="dot"></span>
            <span>${ageString(token.pairCreatedAt)}</span>
          </div>
        </div>
        <div class="cs-sim-matches">
          ${chip(token.match.ticker, 'T')}
          ${chip(token.match.name, 'N')}
          ${chip(token.match.image, 'I')}
        </div>
      </a>
    `
  }).join('')

  ui.similarContent.innerHTML = note + rows
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
