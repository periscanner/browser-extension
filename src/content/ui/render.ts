import { formatNumber, calculatePercentage } from '../utils/format'
import { ClusterMember, SimilarToken } from '../types'

type Severity = 'danger' | 'warn' | 'low'

const SEV_COLOR: Record<Severity, string> = {
  danger: '#f43f5e',
  warn: '#f59e0b',
  low: '#71717a',
}

// Roles that indicate a wallet is a source/controller of coordination.
const ACCENT_ROLES = new Set(['hub', 'funder', 'funded', 'primary'])

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
  const controlClass = totalControl >= 40 ? 'is-danger' : totalControl >= 20 ? 'is-warn' : 'is-safe'

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
    const rows = c.members.map((m: ClusterMember) => {
      const amount = amountMap.get(m.wallet_address) || 0
      const role = (m.role || '').toLowerCase()
      const roleClass = ACCENT_ROLES.has(role)
        ? (sev === 'warn' ? 'cs-row-role--warn' : 'cs-row-role--accent')
        : ''
      const supplyColor = sev === 'danger' ? 'color:#f43f5e' : sev === 'warn' ? 'color:#f59e0b' : 'color:#a1a1aa'
      return `
        <div class="cs-row">
          <span class="cs-row-addr cs-mono" data-full-address="${m.wallet_address}" title="Click to copy">${m.wallet_address.slice(0, 4)}…${m.wallet_address.slice(-3)}</span>
          <span class="cs-row-role ${roleClass}">${m.role || 'member'}</span>
          <span class="cs-row-amount cs-mono">${formatNumber(amount)}</span>
          <span class="cs-row-supply cs-mono" style="${supplyColor}">${calculatePercentage(amount, totalSupply)}</span>
        </div>
      `
    }).join('')

    return `
      <div class="cs-cluster cs-cluster--${sev}">
        <div class="cs-cluster-head">
          <div class="cs-cluster-title">
            <span class="cs-cluster-sev" style="background:${SEV_COLOR[sev]}"></span>
            <a href="https://periscanner.xyz/cluster/${c.cluster_id}" target="_blank" class="cs-cluster-name">${c.cluster_name || 'Unnamed cluster'}</a>
          </div>
          <span class="cs-cluster-pct cs-mono" style="color:${SEV_COLOR[sev]}">${c.pct.toFixed(1)}%</span>
        </div>
        <div class="cs-thead"><span>Wallet</span><span>Role</span><span>Amount</span><span>Supply</span></div>
        ${rows}
      </div>
    `
  }).join('')

  ui.content.innerHTML = cabalBar + cards

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
