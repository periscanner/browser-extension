console.log('[Cluster Scanner] Initializing...')

// Extract token from the embedded iframe's tokenAddress parameter
function extractTokenFromUrl(): string | null {
  // First try to find the iframe with the token address
  const iframe = document.querySelector('iframe[src*="tokenAddress="]')
  if (iframe) {
    const src = iframe.getAttribute('src')
    if (src) {
      const match = src.match(/tokenAddress=([^&]+)/)
      if (match) {
        const token = match[1]
        console.log('[Cluster Scanner] Extracted token from iframe:', token)
        return token
      }
    }
  }

  // Fallback: extract from URL slug (already in base58 format)
  const urlMatch = window.location.pathname.match(/\/meme\/([^\/\?]+)/)
  if (urlMatch) {
    const token = urlMatch[1]
    console.log('[Cluster Scanner] Extracted token from URL:', token)
    return token
  }

  return null
}

// API functions
async function fetchLargestHolders(mintAddress: string) {
  const response = await fetch('https://fibjnghzdogyhjzubokf.supabase.co/functions/v1/scanner-api/get-token-top-holders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mintAddress }),
  });
  if (!response.ok) throw new Error('Failed to fetch holders')
  return response.json()
}

async function fetchClustersByWallets(wallets: string[]) {
  const response = await fetch(
    'https://fibjnghzdogyhjzubokf.supabase.co/functions/v1/scanner-api/get-cluster-by-wallets',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets })
    }
  )
  if (!response.ok) throw new Error('Failed to fetch clusters')
  return response.json()
}

// State
let isExpanded = false
let isDragging = false
let currentX = 0
let currentY = 0
let initialX = 0
let initialY = 0
let offsetX = 0
let offsetY = 0

// Create the widget
function createWidget() {
  const widget = document.createElement('div')
  widget.id = 'cluster-scanner-widget'
  widget.innerHTML = `
    <div class="cs-toggle" id="cs-toggle">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    </div>
    <div class="cs-panel" id="cs-panel">
      <div class="cs-header">
        <h3>Cluster Scanner</h3>
        <button class="cs-close" id="cs-close">×</button>
      </div>
      <div class="cs-content" id="cs-content">
        <div class="cs-loading">Initializing...</div>
      </div>
      <button class="cs-refresh" id="cs-refresh">Refresh Scan</button>
    </div>
  `
  document.body.appendChild(widget)

  // Add styles
  const style = document.createElement('style')
  style.textContent = `
    #cluster-scanner-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .cs-toggle {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      color: white;
    }

    .cs-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.5);
    }

    .cs-toggle:active {
      transform: scale(0.95);
    }

    .cs-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 380px;
      max-height: 600px;
      background: #0f172a;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #1e293b;
    }

    .cs-panel.expanded {
      display: flex;
    }

    .cs-header {
      padding: 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cs-header h3 {
      margin: 0;
      color: #60a5fa;
      font-size: 16px;
      font-weight: 600;
    }

    .cs-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }

    .cs-close:hover {
      color: #f1f5f9;
    }

    .cs-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      color: #e2e8f0;
    }

    .cs-content::-webkit-scrollbar {
      width: 4px;
    }

    .cs-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .cs-content::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 10px;
    }

    .cs-loading {
      text-align: center;
      padding: 40px 20px;
      color: #94a3b8;
    }

    .cs-error {
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      padding: 12px;
      border-radius: 8px;
      color: #fca5a5;
      font-size: 14px;
    }

    .cs-empty {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
      font-style: italic;
    }

    .cs-cluster {
      margin-bottom: 16px;
    }

    .cs-cluster-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 8px;
    }

    .cs-cluster-name {
      font-size: 12px;
      font-weight: 600;
      color: #93c5fd;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cs-cluster-id {
      font-size: 9px;
      color: #64748b;
    }

    .cs-members {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }

    .cs-member {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(30, 41, 59, 0.5);
    }

    .cs-member:last-child {
      border-bottom: none;
    }

    .cs-member-address {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: #94a3b8;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cs-member-amount {
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .cs-refresh {
      margin: 12px 16px;
      padding: 10px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .cs-refresh:hover {
      background: #3b82f6;
    }

    .cs-refresh:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .cs-refresh:disabled:hover {
      background: #2563eb;
    }
  `
  document.head.appendChild(style)

  return widget
}

// Initialize widget
const widget = createWidget()
const toggle = document.getElementById('cs-toggle')!
const panel = document.getElementById('cs-panel')!
const closeBtn = document.getElementById('cs-close')!
const content = document.getElementById('cs-content')!
const refreshBtn = document.getElementById('cs-refresh')! as HTMLButtonElement

// Toggle panel
toggle.addEventListener('click', (e) => {
  e.stopPropagation() // Prevent event bubbling
  if (!isDragging) {
    isExpanded = !isExpanded
    panel.classList.toggle('expanded', isExpanded)
    if (isExpanded && !content.dataset.loaded) {
      loadData()
    }
  }
})

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation() // Prevent event bubbling
  isExpanded = false
  panel.classList.remove('expanded')
})

refreshBtn.addEventListener('click', () => {
  if (!refreshBtn.disabled) {
    loadData()
  }
})

// Dragging functionality
toggle.addEventListener('mousedown', dragStart)

function dragStart(e: MouseEvent) {
  initialX = e.clientX - offsetX
  initialY = e.clientY - offsetY
  isDragging = false

  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', dragEnd)
}

function drag(e: MouseEvent) {
  e.preventDefault()
  currentX = e.clientX - initialX
  currentY = e.clientY - initialY

  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) {
    isDragging = true
  }

  if (isDragging) {
    offsetX = currentX
    offsetY = currentY
    widget.style.transform = `translate(${currentX}px, ${currentY}px)`
  }
}

function dragEnd() {
  initialX = currentX
  initialY = currentY

  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', dragEnd)

  setTimeout(() => { isDragging = false }, 100)
}

// Load and display data
async function loadData() {
  const token = extractTokenFromUrl()

  if (!token) {
    content.innerHTML = '<div class="cs-empty">No token found in URL</div>'
    return
  }

  content.innerHTML = '<div class="cs-loading">Analyzing clusters...</div>'
  content.dataset.loaded = 'true'
  refreshBtn.disabled = true

  try {
    const holdersData = await fetchLargestHolders(token)
    const holders = holdersData.holders || []

    if (holders.length === 0) {
      content.innerHTML = '<div class="cs-empty">No holders found</div>'
      refreshBtn.disabled = false
      return
    }

    const wallets = holders.map((h: any) => h.accountAddress)
    const clustersData = await fetchClustersByWallets(wallets)
    const clusters = clustersData.clusters || []

    // Create holder amount map
    const amountMap = new Map<string, number>(
      holders.map((h: any) => [h.accountAddress as string, h.humanReadableAmount as number])
    )

    // Filter and sort clusters
    const walletSet = new Set(wallets)
    const filteredClusters = clusters
      .map((cluster: any) => {
        const matchingMembers = cluster.members
          .filter((m: any) => walletSet.has(m.wallet_address))
          .sort((a: any, b: any) => {
            const amountA = amountMap.get(a.wallet_address) ?? 0
            const amountB = amountMap.get(b.wallet_address) ?? 0
            return (amountB as number) - (amountA as number)
          })

        return matchingMembers.length > 0
          ? { ...cluster, members: matchingMembers }
          : null
      })
      .filter((c: any) => c !== null)

    displayClusters(filteredClusters, amountMap)
  } catch (error) {
    content.innerHTML = `<div class="cs-error">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  } finally {
    refreshBtn.disabled = false
  }
}

function displayClusters(clusters: any[], amountMap: Map<string, number>) {
  if (clusters.length === 0) {
    content.innerHTML = '<div class="cs-empty">No clusters found for these holders</div>'
    return
  }

  const html = clusters.map(cluster => `
    <div class="cs-cluster">
      <div class="cs-cluster-header">
        <div class="cs-cluster-name">${cluster.cluster_name || 'Unnamed Cluster'}</div>
        <div class="cs-cluster-id">ID: ${cluster.cluster_id}</div>
      </div>
      <div class="cs-members">
        ${cluster.members.map((member: any) => `
          <div class="cs-member">
            <div class="cs-member-address">${member.wallet_address}</div>
            <div class="cs-member-amount">
              ${(amountMap.get(member.wallet_address) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  content.innerHTML = html
}

// Watch for URL changes (for SPAs)
let lastUrl = window.location.href
new MutationObserver(() => {
  const currentUrl = window.location.href
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl
    content.dataset.loaded = ''
    if (isExpanded) {
      loadData()
    }
  }
}).observe(document.body, { childList: true, subtree: true })

console.log('[Cluster Scanner] Ready!')