import { fetchScanResults, fetchClustersByWallets } from './services/api'
import { extractTokenFromUrl } from './services/scanner'

import { formatNumber } from './utils/format'
import { makeDraggable } from './utils/drag'

import { createStyles } from './ui/styles'
import { createWidgetElements } from './ui/dom'
import { renderResults } from './ui/render'

import type { ClusterMember, ClusterWithMembers, ScanResult, TokenHolder } from './types'

async function runScan(ui: any) {
  const addressFromUrl = extractTokenFromUrl()

  if (!addressFromUrl) {
    ui.content.innerHTML = `<div class="cs-error">Could not find address in URL. Open a Pair or Token page.</div>`
    return
  }

  ui.content.innerHTML = `<div class="cs-loading">Resolving Pair & Scanning Holders...</div>`
  ui.refreshBtn.disabled = true

  try {
    const scanData: ScanResult = await fetchScanResults(addressFromUrl)
    console.log('[Cluster Scanner] Scan data:', scanData)

    const holders: TokenHolder[] = scanData.holders || []
    const totalSupply = scanData.stats.totalSupply

    if (holders.length === 0) {
      ui.content.innerHTML = `<div class="cs-empty">No holders found.</div>`
      return
    }

    // Display stats
    ui.stats.innerHTML = `
      <div class="cs-stats-row">
        <span class="cs-stats-label">Total Supply:</span>
        <span class="cs-stats-value">${formatNumber(totalSupply, 0)}</span>
      </div>
      <div class="cs-stats-row">
        <span class="cs-stats-label">Unique Holders:</span>
        <span class="cs-stats-value">${scanData.totalUniqueHolders.toLocaleString()}</span>
      </div>
      <div class="cs-stats-row">
        <span class="cs-stats-label">Top 20 Hold:</span>
        <span class="cs-stats-value">${scanData.stats.percentageOfSupply.toFixed(2)}%</span>
      </div>
      <div class="cs-stats-row">
        <span class="cs-stats-label">Decimals:</span>
        <span class="cs-stats-value">${scanData.metadata.decimals}</span>
      </div>
    `

    const walletAddresses = holders.map((h: TokenHolder) => h.owner)

    const amountMap = new Map<string, number>(
      holders.map((h: TokenHolder) => [h.owner, h.humanReadableAmount])
    )

    ui.content.innerHTML = `<div class="cs-loading">Analyzing ${holders.length} unique holders for clusters...</div>`

    const clusterResponse = await fetchClustersByWallets(walletAddresses)
    const clusters: ClusterWithMembers[] = clusterResponse.clusters || []

    console.log('[Cluster Scanner] Raw clusters:', clusters)
    console.log('[Cluster Scanner] First cluster members:', clusters[0]?.members)

    const relevantClusters = clusters
      .map((cluster: ClusterWithMembers) => {
        console.log(`[Cluster Scanner] Processing cluster ${cluster.cluster_id}`)
        console.log(`[Cluster Scanner] Total members in cluster:`, cluster.members?.length)

        // The members array should already be parsed from the RPC
        const members: ClusterMember[] = Array.isArray(cluster.members) ? cluster.members : []

        console.log(`[Cluster Scanner] Members array:`, members)

        const validMembers = members
          .filter((m: ClusterMember) => {
            const hasAmount = amountMap.has(m.wallet_address)
            console.log(`[Cluster Scanner] Member ${m.wallet_address}: in top 20? ${hasAmount}`)
            return hasAmount
          })
          .sort((a: ClusterMember, b: ClusterMember) => {
            const amountA = amountMap.get(a.wallet_address) || 0
            const amountB = amountMap.get(b.wallet_address) || 0
            return amountB - amountA
          })

        console.log(`[Cluster Scanner] Valid members after filter:`, validMembers.length)

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
      .filter((c: any) => c.members.length > 0)
      .sort((a: any, b: any) => b.totalAmount - a.totalAmount)

    console.log('[Cluster Scanner] Relevant clusters after processing:', relevantClusters)

    renderResults(ui, relevantClusters, amountMap, totalSupply)

  } catch (err) {
    console.error('[Cluster Scanner] Error:', err)
    ui.content.innerHTML = `<div class="cs-error">${err instanceof Error ? err.message : 'Unknown Error'}</div>`
  } finally {
    ui.refreshBtn.disabled = false
  }
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
        runScan(ui)
      }
    } else {
      ui.panel.style.display = 'none'
    }
  })

  ui.closeBtn.addEventListener('click', () => {
    ui.panel.style.display = 'none'
  })

  ui.refreshBtn.addEventListener('click', () => runScan(ui))

  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log('[Cluster Scanner] URL changed, resetting...')
      ui.content.innerHTML = `<div class="cs-loading">URL changed. Click Refresh.</div>`
      ui.stats.innerHTML = ''
    }
  }).observe(document.body, { childList: true, subtree: true })

  console.log('[Cluster Scanner] Ready!')
})()