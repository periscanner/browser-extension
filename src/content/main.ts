console.log('[Cluster Scanner] Initializing...')

const LOGO_PATH = 'https://fibjnghzdogyhjzubokf.supabase.co/storage/v1/object/public/periscanner/clusters/periscanner_logo.png'

const API_URL = 'https://scanner-api.periscannerx.workers.dev/api'

// --- TYPE DEFINITIONS ---

type MemberRole = "hub" | "primary" | "core" | "auxiliary" | "external"

interface ClusterMember {
  cluster_id: string
  wallet_address: string
  role: MemberRole
  confidence_score: number
  joined_at: string
}

interface ClusterWithMembers {
  cluster_id: string
  cluster_name: string | null
  members: ClusterMember[]
}

interface TokenHolder {
  owner: string
  amount: string
  humanReadableAmount: number
  tokenAccountAddress: string
}

interface ScanResult {
  resolvedMint: string
  holders: TokenHolder[]
  count: number
  totalUniqueHolders: number
  stats: {
    totalHolders: number
    top20Count: number
    totalInTop20: number
    percentageOfSupply: number
    totalSupply: number
  }
  metadata: {
    decimals: number
    supply: string
  }
}

interface ClusterResponse {
  clusters: ClusterWithMembers[]
  count: number
}

// --- UTILITY FUNCTIONS ---

function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`
  }
  return num.toFixed(decimals)
}

function calculatePercentage(amount: number, totalSupply: number): string {
  const percentage = (amount / totalSupply) * 100
  return `${percentage.toFixed(2)}%`
}

// --- CORE LOGIC & API ---

function extractTokenFromUrl(): string | null {
  const path = window.location.pathname
  const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/
  const pathMatch = path.match(addressRegex)

  if (pathMatch) {
    console.log('[Cluster Scanner] Found address in path:', pathMatch[0])
    return pathMatch[0]
  }

  const iframe = document.querySelector('iframe[src*="tokenAddress="]')
  if (iframe) {
    const src = iframe.getAttribute('src')
    if (src) {
      const match = src.match(/tokenAddress=([^&]+)/)
      if (match) {
        console.log('[Cluster Scanner] Found token in iframe:', match[1])
        return match[1]
      }
    }
  }

  return null
}

async function fetchScanResults(urlTokenAddress: string): Promise<ScanResult> {
  const response = await fetch(`${API_URL}/extension/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urlTokenAddress }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to scan pair')
  }

  return await response.json()
}

async function fetchClustersByWallets(wallets: string[]): Promise<ClusterResponse> {
  const response = await fetch(`${API_URL}/cluster/by-wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets })
  })

  if (!response.ok) throw new Error('Failed to fetch clusters')
  return await response.json()
}

// --- UI CREATION ---

function createStyles() {
  const style = document.createElement('style')
  style.textContent = `
    #cluster-scanner-widget {
      position: fixed; 
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      touch-action: none;
      user-select: none; 
    }

    .cs-toggle {
      width: 56px;
      height: 56px;
      background: #1e293b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      transition: transform 0.1s;
      border: 2px solid #334155;
      padding: 0;
      overflow: hidden;
    }

    .cs-toggle:active {
      cursor: grabbing;
      transform: scale(0.95);
    }

    .cs-toggle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .cs-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 420px;
      max-height: 600px;
      background: #0f172a;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: none;
      flex-direction: column;
      border: 1px solid #1e293b;
    }

    .cs-panel.visible { display: flex; }

    .cs-header {
      padding: 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .cs-header h3 { margin: 0; color: #60a5fa; font-size: 16px; font-weight: 600; }
    
    .cs-close {
      background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer;
    }
    .cs-close:hover { color: white; }

    .cs-stats {
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.5);
      border-bottom: 1px solid #334155;
      font-size: 11px;
      color: #94a3b8;
    }

    .cs-stats-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .cs-stats-label { color: #64748b; }
    .cs-stats-value { color: #e2e8f0; font-weight: 500; }

    .cs-content { flex: 1; overflow-y: auto; padding: 16px; color: #e2e8f0; max-height: 400px; }
    
    .cs-loading { padding: 20px; text-align: center; color: #94a3b8; }
    .cs-error { background: #450a0a; color: #fca5a5; padding: 10px; border-radius: 6px; font-size: 13px; }
    .cs-empty { text-align: center; color: #64748b; padding: 20px; }
    
    .cs-cluster { 
      margin-bottom: 12px; 
      background: rgba(30, 41, 59, 0.3); 
      border-radius: 8px; 
      padding: 10px; 
      border: 1px solid #334155; 
    }
    
    .cs-cluster-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      margin-bottom: 8px; 
    }
    
    .cs-cluster-name { 
      font-weight: bold; 
      color: #93c5fd; 
      font-size: 13px; 
    }
    
    .cs-cluster-total {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-size: 10px;
    }
    
    .cs-cluster-amount {
      color: #fbbf24;
      font-weight: 600;
      font-size: 9px;
    }
    
    .cs-cluster-percentage {
      color: #10b981;
      font-size: 14px;
    }
    
    .cs-member { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      font-size: 11px; 
      padding: 4px 0; 
      border-bottom: 1px solid rgba(255,255,255,0.05); 
    }
    
    .cs-member:last-child {
      border-bottom: none;
    }
    
    .cs-member-left {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .cs-member-addr { 
      font-family: monospace; 
      color: #94a3b8; 
    }
    
    .cs-member-role { 
      font-size: 9px; 
      color: #64748b; 
      background: rgba(100, 116, 139, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .cs-member-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .cs-member-amount {
      color: #e2e8f0;
      font-size: 11px;
    }
    
    .cs-member-percentage {
      color: #10b981;
      font-size: 9px;
    }
    
    .cs-member-score { 
      font-size: 9px; 
      color: #fbbf24; 
      margin-left: 4px;
    }
    
    .cs-refresh {
      margin: 10px; 
      padding: 10px; 
      background: #2563eb; 
      color: white; 
      border: none; 
      border-radius: 6px; 
      cursor: pointer; 
      font-weight: 600;
    }
    
    .cs-refresh:disabled { 
      opacity: 0.5; 
      cursor: not-allowed; 
    }

    .cs-meta { 
      font-size: 10px; 
      color: #64748b; 
      padding: 0 16px 8px; 
      text-align: right; 
    }
  `
  document.head.appendChild(style)
}

function createWidgetElements() {
  const widget = document.createElement('div')
  widget.id = 'cluster-scanner-widget'
  widget.innerHTML = `
    <button id="cs-toggle" class="cs-toggle" title="Drag to move, click to toggle">
      <img src="${LOGO_PATH}" alt="Scanner" />
    </button>
    <div id="cs-panel" class="cs-panel">
      <div class="cs-header">
        <h3>Cluster Scanner</h3>
        <button id="cs-close" class="cs-close">×</button>
      </div>
      <div id="cs-stats" class="cs-stats"></div>
      <div id="cs-content" class="cs-content">
        <div class="cs-loading">Click Refresh to scan</div>
      </div>
      <button id="cs-refresh" class="cs-refresh">Refresh Scan</button>
    </div>
  `
  document.body.appendChild(widget)
  return {
    container: widget,
    toggleBtn: widget.querySelector('#cs-toggle') as HTMLElement,
    panel: widget.querySelector('#cs-panel') as HTMLElement,
    closeBtn: widget.querySelector('#cs-close') as HTMLElement,
    stats: widget.querySelector('#cs-stats') as HTMLElement,
    content: widget.querySelector('#cs-content') as HTMLElement,
    refreshBtn: widget.querySelector('#cs-refresh') as HTMLButtonElement
  }
}

// --- DRAG & DROP LOGIC ---

function makeDraggable(container: HTMLElement, handle: HTMLElement) {
  let isDragging = false
  let hasMoved = false
  let startX = 0
  let startY = 0
  let initialLeft = 0
  let initialTop = 0

  handle.addEventListener('pointerdown', startDrag)

  function startDrag(e: PointerEvent) {
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)

    const rect = container.getBoundingClientRect()
    container.style.bottom = 'auto'
    container.style.right = 'auto'
    container.style.left = `${rect.left}px`
    container.style.top = `${rect.top}px`

    startX = e.clientX
    startY = e.clientY
    initialLeft = rect.left
    initialTop = rect.top

    isDragging = true
    hasMoved = false

    handle.addEventListener('pointermove', onPointerMove)
    handle.addEventListener('pointerup', onPointerUp)
    handle.addEventListener('pointercancel', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true

    let newLeft = initialLeft + dx
    let newTop = initialTop + dy

    const maxLeft = window.innerWidth - container.offsetWidth
    const maxTop = window.innerHeight - container.offsetHeight
    newLeft = Math.max(0, Math.min(newLeft, maxLeft))
    newTop = Math.max(0, Math.min(newTop, maxTop))

    container.style.left = `${newLeft}px`
    container.style.top = `${newTop}px`
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return
    isDragging = false
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
    setTimeout(() => { hasMoved = false }, 100)
  }

  return { wasDragging: () => hasMoved }
}

// --- DATA LOGIC ---

async function runScan(ui: any) {
  const addressFromUrl = extractTokenFromUrl()

  if (!addressFromUrl) {
    ui.content.innerHTML = `<div class="cs-error">Could not find address in URL. Open a Pair or Token page.</div>`
    return
  }

  ui.content.innerHTML = `<div class="cs-loading">Resolving Pair & Scanning Holders...</div>`
  ui.refreshBtn.disabled = true

  try {
    const scanData = await fetchScanResults(addressFromUrl)
    console.log('[Cluster Scanner] Scan data:', scanData)

    const holders = scanData.holders || []
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
    const clusters = clusterResponse.clusters || []

    console.log('[Cluster Scanner] Raw clusters:', clusters)
    console.log('[Cluster Scanner] First cluster members:', clusters[0]?.members)

    const relevantClusters = clusters
      .map((cluster: ClusterWithMembers) => {
        console.log(`[Cluster Scanner] Processing cluster ${cluster.cluster_id}`)
        console.log(`[Cluster Scanner] Total members in cluster:`, cluster.members?.length)

        // The members array should already be parsed from the RPC
        const members = Array.isArray(cluster.members) ? cluster.members : []

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
          (sum, m) => sum + (amountMap.get(m.wallet_address) || 0),
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

function renderResults(
  ui: any,
  clusters: any[],
  amountMap: Map<string, number>,
  totalSupply: number
) {
  if (clusters.length === 0) {
    ui.content.innerHTML = `<div class="cs-empty">No shared clusters found among top holders.</div>`
    return
  }

  const html = clusters.map((c: any) => `
    <div class="cs-cluster">
      <div class="cs-cluster-header">
        <span class="cs-cluster-name">${c.cluster_name || 'Unnamed Cluster'}</span>
        <div class="cs-cluster-total">
          <span class="cs-cluster-amount">${formatNumber(c.totalAmount)}</span>
          <span class="cs-cluster-percentage">${calculatePercentage(c.totalAmount, totalSupply)}</span>
        </div>
      </div>
      <div>
        ${c.members.map((m: ClusterMember) => {
    const amount = amountMap.get(m.wallet_address) || 0
    return `
            <div class="cs-member">
              <div class="cs-member-left">
                <span class="cs-member-addr">${m.wallet_address.slice(0, 4)}...${m.wallet_address.slice(-4)}</span>
                <span class="cs-member-role">${m.role}</span>
              </div>
              <div class="cs-member-right">
                <span class="cs-member-amount">${formatNumber(amount)}</span>
                <span class="cs-member-percentage">${calculatePercentage(amount, totalSupply)}</span>
              </div>
            </div>
          `
  }).join('')}
      </div>
    </div>
  `).join('')

  ui.content.innerHTML = html
}

// --- INITIALIZATION ---

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