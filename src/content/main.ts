import { fetchScanResults, fetchClustersByWallets, submitIngestJob, pollIngestJob, fetchSimilarTokens } from './services/api'
import { extractTokenFromUrl } from './services/scanner'

import { calculatePercentage } from './utils/format'
import { makeDraggable } from './utils/drag'

import { createStyles } from './ui/styles'
import { createWidgetElements } from './ui/dom'
import { renderResults, renderSimilarTokens } from './ui/render'

import type { ClusterMember, ClusterWithMembers, ScanResult, TokenHolder, SimilarToken } from './types'

const SYSTEM_WALLETS = new Set([
  '6EF8rSutb9YvXWvP3NMWH5A7yQW52X4N1CdcS668JAt5', // Pump.fun Bonding Curve
  '5Q54nC7onSgSJ8Ct37628oP57Fz6Y392S28k8B1R8M99', // Raydium Authority
  '11111111111111111111111111111111',           // System Program / Burn
  'TokenkegQFEZmcsp366nz8SE69bb376o16Mxn4f8B8',   // Token Program
])

let tokenMetadata: { name: string; symbol: string; imageUrl?: string } | null = null
let similarTokensData: SimilarToken[] | null = null
let currentMarketCap: number | null = null
let oldestBondedToken: SimilarToken | null = null
let top20Percentage: string | null = null
let currentMint: string | null = null
let clusterCount: number | null = null
let uniqueHolders: number | null = null

// Renders the header (token identity + derived risk verdict) and the KPI chip
// strip. Safe to call at any scan stage — missing values render as placeholders.
function renderTop(ui: any) {
  const hasToken = !!tokenMetadata
  const symbol = hasToken ? `$${tokenMetadata!.symbol || tokenMetadata!.name || '???'}` : 'Periscanner'
  const mintShort = currentMint
    ? `${currentMint.slice(0, 4)}…${currentMint.slice(-4)}`
    : (hasToken ? '' : 'no token loaded')
  const avatar = hasToken && tokenMetadata!.imageUrl
    ? `<div class="cs-token-avatar"><img src="${tokenMetadata!.imageUrl}" alt="" /><span class="cs-token-dot"></span></div>`
    : `<div class="cs-token-avatar"><div class="cs-token-glyph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg></div></div>`
  ui.token.innerHTML = `${avatar}<div class="cs-token-meta"><span class="cs-token-symbol">${symbol}</span><span class="cs-token-mint cs-mono">${mintShort}</span></div>`

  // Verdict: worst of top-20 concentration tier and cluster-count tier.
  const t20 = top20Percentage !== null ? parseFloat(top20Percentage) : null
  let vClass = 'cs-verdict--neutral'
  let vLabel = 'Scan'
  if (t20 !== null && !Number.isNaN(t20)) {
    let tier = t20 >= 50 ? 2 : t20 >= 30 ? 1 : 0
    if (clusterCount !== null) {
      if (clusterCount >= 3) tier = 2
      else if (clusterCount >= 1 && tier === 0) tier = 1
    }
    if (tier === 2) { vClass = 'cs-verdict--danger'; vLabel = 'Cabal Risk' }
    else if (tier === 1) { vClass = 'cs-verdict--warn'; vLabel = 'Caution' }
    else { vClass = 'cs-verdict--safe'; vLabel = 'Clean' }
  }
  ui.verdict.className = `cs-verdict ${vClass}`
  ui.verdict.innerHTML = `<span class="cs-verdict-dot"></span>${vLabel}`

  // KPI chips
  const chip = (label: string, value: string, cls = '') =>
    `<div class="cs-kpi"><span class="cs-kpi-label">${label}</span><span class="cs-kpi-value ${cls}">${value}</span></div>`

  const t20Cls = t20 === null || Number.isNaN(t20) ? '' : t20 >= 50 ? 'is-danger' : t20 >= 30 ? 'is-warn' : 'is-safe'
  const chips: string[] = []
  chips.push(chip('Top 20', `<span class="cs-mono">${top20Percentage ?? '…'}</span>`, t20Cls))

  if (currentMarketCap !== null) {
    const bonded = currentMarketCap >= 60000
    chips.push(chip('Bonded', bonded ? 'Yes' : 'No', bonded ? 'is-safe' : 'is-warn'))
  } else {
    chips.push(chip('Bonded', '…'))
  }

  const clCls = clusterCount === null ? '' : clusterCount >= 3 ? 'is-danger' : clusterCount >= 1 ? 'is-warn' : 'is-safe'
  chips.push(chip('Clusters', `<span class="cs-mono">${clusterCount ?? '…'}</span>`, clCls))
  chips.push(chip('Holders', `<span class="cs-mono">${uniqueHolders !== null ? uniqueHolders.toLocaleString() : '…'}</span>`, 'is-muted'))

  if (similarTokensData !== null) {
    chips.push(chip('Similar', `<span class="cs-mono">${similarTokensData.length}</span>`, similarTokensData.length > 0 ? 'is-warn' : 'is-muted'))
    if (oldestBondedToken) {
      chips.push(chip('OG token', `<a href="${oldestBondedToken.axiomLink}" target="_self" class="cs-kpi-link">Go to OG →</a>`))
    }
  }

  ui.summary.innerHTML = chips.join('')
}

async function fetchAndRenderSimilarTokens(ui: any) {
  if (!tokenMetadata) {
    ui.similarContent.innerHTML = `<div class="cs-error">No token metadata available. Scan a token first.</div>`
    return
  }

  ui.similarContent.innerHTML = `<div class="cs-loading">Searching for similar tokens...</div>`

  try {
    const response = await fetchSimilarTokens(
      tokenMetadata.name,
      tokenMetadata.symbol,
      tokenMetadata.imageUrl
    )

    similarTokensData = response.tokens

    // Find oldest bonded token (market cap >= 60k)
    const bondedTokens = similarTokensData.filter(t => t.marketCap >= 60000)
    oldestBondedToken = bondedTokens.length > 0 ? bondedTokens[0] : null

    renderSimilarTokens(ui, similarTokensData)
    renderTop(ui)
  } catch (err) {
    console.error('[Cluster Scanner] Similar tokens error:', err)
    ui.similarContent.innerHTML = `<div class="cs-error">${err instanceof Error ? err.message : 'Failed to fetch similar tokens'}</div>`
  }
}

function switchTab(ui: any, tab: 'clusters' | 'similar') {
  if (tab === 'clusters') {
    ui.tabClusters.classList.add('cs-tab-active')
    ui.tabSimilar.classList.remove('cs-tab-active')
    ui.content.style.display = 'block'
    ui.similarContent.style.display = 'none'
  } else {
    ui.tabSimilar.classList.add('cs-tab-active')
    ui.tabClusters.classList.remove('cs-tab-active')
    ui.content.style.display = 'none'
    ui.similarContent.style.display = 'block'
  }
}

async function runScan(ui: any, deepScan = false) {
  const addressFromUrl = extractTokenFromUrl()

  if (!addressFromUrl) {
    ui.content.innerHTML = `<div class="cs-error">Could not find address in URL. Open a Pair or Token page.</div>`
    return
  }

  ui.content.innerHTML = `<div class="cs-loading">Resolving Pair & Scanning Holders...</div>`
  ui.refreshBtn.disabled = true
  ui.deepAnalyzeBtn.disabled = true

  // Reset Globals
  tokenMetadata = null
  similarTokensData = null
  currentMarketCap = null
  oldestBondedToken = null
  top20Percentage = null
  currentMint = addressFromUrl
  clusterCount = null
  uniqueHolders = null

  // Render initial header/KPIs (loading state)
  renderTop(ui)

  // Resolve pair to mint if possible using DexScreener
  let mintAddress = addressFromUrl
  try {
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addressFromUrl}`)
    const dexData: any = await dexResponse.json()
    if (dexData.pairs && dexData.pairs.length > 0) {
      const pair = dexData.pairs[0]
      mintAddress = pair.baseToken.address // Use the resolved mint address

      tokenMetadata = {
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        imageUrl: pair.info?.imageUrl
      }
      currentMarketCap = pair.marketCap || 0
      currentMint = mintAddress
      console.log('[Cluster Scanner] Resolved Mint:', mintAddress)
      console.log('[Cluster Scanner] Token metadata:', tokenMetadata)
      renderTop(ui)
    }
  } catch (metaErr) {
    console.warn('[Cluster Scanner] Failed to fetch/resolve token metadata:', metaErr)
  }

  try {
    // 1. Fetch Top Holders
    const scanData: ScanResult = await fetchScanResults(mintAddress)
    console.log('[Cluster Scanner] Scan data:', scanData)

    const holders: TokenHolder[] = scanData.holders || []
    const totalSupply = scanData.stats.totalSupply

    if (holders.length === 0) {
      ui.content.innerHTML = `<div class="cs-empty">No holders found.</div>`
      return
    }

    // Filter out system wallets for concentration stats
    const nonSystemHolders = holders.filter(h => !SYSTEM_WALLETS.has(h.owner))

    // Top-20 concentration (excludes LPs / bonding curves) drives the verdict + KPIs.
    const top20NonSystem = nonSystemHolders.slice(0, 20)
    const top20Amount = top20NonSystem.reduce((sum, h) => sum + h.humanReadableAmount, 0)
    top20Percentage = calculatePercentage(top20Amount, totalSupply)
    uniqueHolders = scanData.totalUniqueHolders
    renderTop(ui)

    const walletAddresses = holders.map((h: TokenHolder) => h.owner)

    const amountMap = new Map<string, number>(
      holders.map((h: TokenHolder) => [h.owner, h.humanReadableAmount])
    )

    ui.content.innerHTML = `<div class="cs-loading">Checking known clusters...</div>`

    // 2. Fetch Known Clusters
    let clusterResponse = await fetchClustersByWallets(walletAddresses)
    let clusters: ClusterWithMembers[] = clusterResponse.clusters || []

    // 3. Deep Scan Logic
    if (deepScan) {
      // Find holders that are NOT in the returned clusters
      const knownWallets = new Set<string>()
      clusters.forEach(c => {
        c.members.forEach(m => knownWallets.add(m.wallet_address))
      })

      const unknownHolders = holders.filter(h => !knownWallets.has(h.owner) && !SYSTEM_WALLETS.has(h.owner))
      const candidatesToIngest = unknownHolders.slice(0, 10).map(h => h.owner)

      if (candidatesToIngest.length > 0) {
        ui.content.innerHTML = `<div class="cs-loading">Queuing analysis of ${candidatesToIngest.length} new top holders...</div>`

        try {
          // Submit an async ingestion job (Cloudflare Queues) and poll for progress.
          // The heavy Helius/clustering work runs in the background off the request path.
          const ticket = await submitIngestJob(candidatesToIngest, 'normal')

          await pollIngestJob(ticket.jobId, (progress, processed, total) => {
            const pct = Math.round(progress * 100)
            const totalCount = total ?? candidatesToIngest.length
            ui.content.innerHTML = `<div class="cs-loading">Analyzing top holders… ${processed}/${totalCount} (${pct}%)</div>`
          })

          // Re-fetch clusters to include the newly analyzed ones
          ui.content.innerHTML = `<div class="cs-loading">Refreshing cluster data...</div>`
          clusterResponse = await fetchClustersByWallets(walletAddresses)
          clusters = clusterResponse.clusters || []
        } catch (ingestErr) {
          console.error('[Cluster Scanner] Ingest error:', ingestErr)
          ui.content.insertAdjacentHTML('afterbegin', `<div class="cs-error">Analysis partial failure. Showing existing data.</div>`)
        }
      } else {
        console.log('[Cluster Scanner] All top holders already analyzed.')
      }
    }

    // 4. Process & Render
    console.log('[Cluster Scanner] Raw clusters:', clusters)

    const relevantClusters = processClusters(clusters, amountMap)
    clusterCount = relevantClusters.length
    renderTop(ui)

    renderResults(ui, relevantClusters, amountMap, totalSupply)

    // Auto-load similar tokens if on axiom.trade domain
    const isAxiomTrade = window.location.hostname.includes('axiom.trade')
    if (isAxiomTrade && tokenMetadata) {
      console.log('[Cluster Scanner] Auto-loading similar tokens on axiom.trade')
      await fetchAndRenderSimilarTokens(ui)
    }

  } catch (err) {
    console.error('[Cluster Scanner] Error:', err)
    ui.content.innerHTML = `<div class="cs-error">${err instanceof Error ? err.message : 'Unknown Error'}</div>`
  } finally {
    ui.refreshBtn.disabled = false
    ui.deepAnalyzeBtn.disabled = false
  }
}

function processClusters(clusters: ClusterWithMembers[], amountMap: Map<string, number>) {
  return clusters
    .map((cluster: ClusterWithMembers) => {
      const members: ClusterMember[] = Array.isArray(cluster.members) ? cluster.members : []

      // Filter members to only include those that hold the token (present in amountMap)
      const validMembers = members
        .filter((m: ClusterMember) => amountMap.has(m.wallet_address))
        .sort((a: ClusterMember, b: ClusterMember) => {
          const amountA = amountMap.get(a.wallet_address) || 0
          const amountB = amountMap.get(b.wallet_address) || 0
          return amountB - amountA
        })

      const clusterTotal = validMembers.reduce(
        (sum, m: ClusterMember) => sum + (amountMap.get(m.wallet_address) || 0),
        0
      )

      return {
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        members: validMembers,
        totalAmount: clusterTotal,
        totalMembersInCluster: members.length,
      }
    })
    // We only show clusters that have at least one member in our top holders list
    .filter((c: any) => c.members.length > 0)
    .sort((a: any, b: any) => b.totalAmount - a.totalAmount)
}

(function init() {
  createStyles()
  const ui = createWidgetElements()

  const dragSystem = makeDraggable(ui.container, ui.toggleBtn)

  function toggleWidget() {
    const isClosed = ui.panel.style.display === 'none' || ui.panel.style.display === ''
    if (isClosed) {
      ui.panel.style.display = 'flex'
      if (ui.content.innerText.includes('Click to scan')) {
        runScan(ui, false)
      }
    } else {
      ui.panel.style.display = 'none'
    }
  }

  ui.toggleBtn.addEventListener('click', () => {
    if (dragSystem.wasDragging()) return
    toggleWidget()
  })

  // Keyboard shortcut: hold Space + press 1 to open/close the widget.
  // Held keys are tracked so the chord works in either press order, auto-repeat
  // is ignored, and keys are never hijacked while typing in a field.
  const heldKeys = new Set<string>()

  const isEditable = (el: EventTarget | null): boolean => {
    const node = el as HTMLElement | null
    if (!node || !node.tagName) return false
    const tag = node.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
  }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat || isEditable(e.target)) return

    heldKeys.add(e.code)

    const spaceHeld = heldKeys.has('Space')
    const oneHeld = heldKeys.has('Digit1') || heldKeys.has('Numpad1')
    if (spaceHeld && oneHeld) {
      e.preventDefault() // stop Space from scrolling / "1" from typing
      toggleWidget()
    }
  })

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    heldKeys.delete(e.code)
  })

  // Clear held state if focus leaves the page mid-chord (avoids a stuck key).
  window.addEventListener('blur', () => heldKeys.clear())

  ui.closeBtn.addEventListener('click', () => {
    ui.panel.style.display = 'none'
  })

  ui.refreshBtn.addEventListener('click', () => {
    runScan(ui, false)
  })

  ui.deepAnalyzeBtn.addEventListener('click', () => {
    runScan(ui, true)
  })

  ui.tabClusters.addEventListener('click', () => {
    switchTab(ui, 'clusters')
  })

  ui.tabSimilar.addEventListener('click', () => {
    switchTab(ui, 'similar')
    // Auto-fetch similar tokens when switching to that tab if we have metadata
    if (tokenMetadata && (similarTokensData === null || similarTokensData.length === 0)) {
      fetchAndRenderSimilarTokens(ui)
    } else if (similarTokensData !== null && similarTokensData.length > 0) {
      // Re-render header/KPIs in case they were stale
      renderTop(ui)
    }
  })

  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log('[Cluster Scanner] URL changed, resetting...')

      // Reset scan state
      tokenMetadata = null
      similarTokensData = null
      currentMarketCap = null
      oldestBondedToken = null
      top20Percentage = null
      currentMint = null
      clusterCount = null
      uniqueHolders = null
      ui.similarContent.innerHTML = `<div class="cs-loading">Scan a token first</div>`
      renderTop(ui)

      // Switch back to clusters tab
      switchTab(ui, 'clusters')

      const address = extractTokenFromUrl()
      if (address) {
        // Auto-scan if we detect a valid token in the new URL
        runScan(ui, false)
      } else {
        ui.content.innerHTML = `<div class="cs-loading">Navigate to a Token Page to scan.</div>`
      }
    }
  }).observe(document.body, { childList: true, subtree: true })

  console.log('[Cluster Scanner] Ready!')
})()
