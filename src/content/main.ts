import { fetchScanResults, fetchClustersByWallets, ingestWalletsBulk, fetchSimilarTokens } from './services/api'
import { extractTokenFromUrl } from './services/scanner'

import { formatNumber, calculatePercentage } from './utils/format'
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

function renderSummary(ui: any) {
  // Bonded Logic
  let bondedDisplay = '<span style="color: #64748b;">...</span>'
  if (currentMarketCap !== null) {
    const isBonded = currentMarketCap >= 60000
    const bondedIcon = isBonded ? '✅' : '❌'
    const bondedClass = isBonded ? 'cs-summary-bonded-yes' : 'cs-summary-bonded-no'
    bondedDisplay = `<span class="${bondedClass}">${bondedIcon}</span>`
  }

  // Similar Tokens Logic
  const similarCount = similarTokensData !== null ? similarTokensData.length : '...'

  // Top 20 Logic
  const top20Display = top20Percentage !== null ? top20Percentage : '...'

  // OG Token Logic
  let ogButton = '<span style="color: #64748b;">...</span>'
  if (similarTokensData !== null) {
    ogButton = oldestBondedToken
      ? `<a href="${oldestBondedToken.axiomLink}" class="cs-summary-og-btn" target="_self">Go to OG</a>`
      : '<span style="color: #64748b;">N/A</span>'
  }

  ui.summary.innerHTML = `
    <div class="cs-summary-item">
      <span class="cs-summary-label">Bonded:</span>
      ${bondedDisplay}
    </div>
    <div class="cs-summary-item">
      <span class="cs-summary-label">Similar Tokens:</span>
      <span class="cs-summary-value">${similarCount}</span>
    </div>
    <div class="cs-summary-item">
      <span class="cs-summary-label">Top 20 Hold:</span>
      <span class="cs-summary-value">${top20Display}</span>
    </div>
    <div class="cs-summary-item">
      <span class="cs-summary-label">OG Token:</span>
      ${ogButton}
    </div>
  `
  ui.summary.style.display = 'grid'
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
    renderSummary(ui)
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

  // Render initial summary (loading state)
  renderSummary(ui)

  try {
    // 1. Fetch Top Holders
    const scanData: ScanResult = await fetchScanResults(addressFromUrl)
    console.log('[Cluster Scanner] Scan data:', scanData)

    const holders: TokenHolder[] = scanData.holders || []
    const totalSupply = scanData.stats.totalSupply

    // 2. Fetch token metadata from DexScreener for similar tokens feature
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addressFromUrl}`)
      const dexData: any = await dexResponse.json()
      if (dexData.pairs && dexData.pairs.length > 0) {
        const pair = dexData.pairs[0]
        tokenMetadata = {
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          imageUrl: pair.info?.imageUrl
        }
        currentMarketCap = pair.marketCap || 0
        console.log('[Cluster Scanner] Token metadata:', tokenMetadata)
        renderSummary(ui)
      }
    } catch (metaErr) {
      console.warn('[Cluster Scanner] Failed to fetch token metadata:', metaErr)
    }

    if (holders.length === 0) {
      ui.content.innerHTML = `<div class="cs-empty">No holders found.</div>`
      return
    }

    // Filter out system wallets for concentration stats
    const nonSystemHolders = holders.filter(h => !SYSTEM_WALLETS.has(h.owner))

    const renderStats = (clusterStat?: string) => {
      // Calculate Top 20 hold excluding system wallets
      const top20NonSystem = nonSystemHolders.slice(0, 20)
      const top20Amount = top20NonSystem.reduce((sum, h) => sum + h.humanReadableAmount, 0)
      top20Percentage = calculatePercentage(top20Amount, totalSupply)

      renderSummary(ui)

      ui.stats.innerHTML = `
        <div class="cs-stats-row">
          <span class="cs-stats-label">Total Supply:</span>
          <span class="cs-stats-value">${formatNumber(totalSupply, 0)}</span>
        </div>
        <div class="cs-stats-row">
          <span class="cs-stats-label">Unique Holders:</span>
          <span class="cs-stats-value">${scanData.totalUniqueHolders.toLocaleString()}</span>
        </div>
        ${clusterStat || ''}
        <div class="cs-stats-row" title="Excludes LPs and Bonding Curves">
          <span class="cs-stats-label">Top 20 Hold:</span>
          <span class="cs-stats-value">${top20Percentage}</span>
        </div>
        <div class="cs-stats-row">
          <span class="cs-stats-label">Decimals:</span>
          <span class="cs-stats-value">${scanData.metadata.decimals}</span>
        </div>
      `
    }

    renderStats()

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
        ui.content.innerHTML = `<div class="cs-loading">Analyzing ${candidatesToIngest.length} new top holders...</div>`

        try {
          // Call Bulk Ingest API
          await ingestWalletsBulk(candidatesToIngest)

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

  ui.toggleBtn.addEventListener('click', () => {
    if (dragSystem.wasDragging()) return

    const isClosed = ui.panel.style.display === 'none' || ui.panel.style.display === ''

    if (isClosed) {
      ui.panel.style.display = 'flex'
      if (ui.content.innerText.includes('Click Refresh')) {
        runScan(ui, false)
      }
    } else {
      ui.panel.style.display = 'none'
    }
  })

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
      // Re-render summary in case it was hidden
      renderSummary(ui)
    }
  })

  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log('[Cluster Scanner] URL changed, resetting...')
      ui.stats.innerHTML = ''

      // Reset similar tokens data
      tokenMetadata = null
      similarTokensData = null
      currentMarketCap = null
      oldestBondedToken = null
      top20Percentage = null
      ui.similarContent.innerHTML = `<div class="cs-loading">Click Refresh to scan</div>`
      ui.summary.style.display = 'none'
      ui.summary.innerHTML = ''

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
