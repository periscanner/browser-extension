console.log('[Cluster Scanner] Initializing...')

const LOGO_PATH = 'https://fibjnghzdogyhjzubokf.supabase.co/storage/v1/object/public/periscanner/clusters/periscanner_logo.png'

const API_URL = 'https://scanner-api.periscannerx.workers.dev/api'

// --- 1. CORE LOGIC & API ---

function extractTokenFromUrl(): string | null {
  const path = window.location.pathname;

  // 1. Try DexScreener / Photon / Solscan pattern (path ends with or contains an address)
  // Matches base58 strings between 32 and 44 chars
  const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

  // Check URL path for an address
  const pathMatch = path.match(addressRegex);
  if (pathMatch) {
    console.log('[Cluster Scanner] Found address in path:', pathMatch[0]);
    return pathMatch[0];
  }

  // 2. Try Iframe (Embeds)
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

async function fetchScanResults(urlTokenAddress: string) {
  // We send the "urlTokenAddress" (which might be a Pair). 
  // The server resolves it to the Mint and returns holders.
  const response = await fetch(`${API_URL}/extension/scan-pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urlTokenAddress }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to scan pair');
  }
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

// --- 2. UI CREATION ---

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
      width: 380px;
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

    .cs-content { flex: 1; overflow-y: auto; padding: 16px; color: #e2e8f0; max-height: 400px; }
    
    .cs-loading { padding: 20px; text-align: center; color: #94a3b8; }
    .cs-error { background: #450a0a; color: #fca5a5; padding: 10px; border-radius: 6px; font-size: 13px; }
    .cs-empty { text-align: center; color: #64748b; padding: 20px; }
    
    .cs-cluster { margin-bottom: 12px; background: rgba(30, 41, 59, 0.3); border-radius: 8px; padding: 10px; border: 1px solid #334155; }
    .cs-cluster-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .cs-cluster-name { font-weight: bold; color: #93c5fd; font-size: 13px; }
    .cs-member { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .cs-member-addr { font-family: monospace; color: #94a3b8; }
    
    .cs-refresh {
      margin: 10px; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
    }
    .cs-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Small badge for resolved mint */
    .cs-meta { font-size: 10px; color: #64748b; padding: 0 16px 8px; text-align: right; }
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
      <div id="cs-content" class="cs-content">
        <div class="cs-loading">Click Refresh to scan</div>
      </div>
      <div id="cs-meta" class="cs-meta"></div>
      <button id="cs-refresh" class="cs-refresh">Refresh Scan</button>
    </div>
  `
  document.body.appendChild(widget)
  return {
    container: widget,
    toggleBtn: widget.querySelector('#cs-toggle') as HTMLElement,
    panel: widget.querySelector('#cs-panel') as HTMLElement,
    closeBtn: widget.querySelector('#cs-close') as HTMLElement,
    content: widget.querySelector('#cs-content') as HTMLElement,
    meta: widget.querySelector('#cs-meta') as HTMLElement,
    refreshBtn: widget.querySelector('#cs-refresh') as HTMLButtonElement
  }
}

// --- 3. ROBUST DRAG & DROP LOGIC ---

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

// --- 4. DATA LOGIC ---

async function runScan(ui: any) {
  const addressFromUrl = extractTokenFromUrl()

  if (!addressFromUrl) {
    ui.content.innerHTML = `<div class="cs-error">Could not find address in URL. Open a Pair or Token page.</div>`
    return
  }

  ui.content.innerHTML = `<div class="cs-loading">Resolving Pair & Scanning Holders...</div>`
  ui.refreshBtn.disabled = true

  try {
    // 1. Fetch scan results (Server resolves Pair->Mint)
    const scanData = await fetchScanResults(addressFromUrl)

    const holders = scanData.holders || []

    if (holders.length === 0) {
      ui.content.innerHTML = `<div class="cs-empty">No holders found.</div>`
      return
    }

    const walletAddresses = holders.map((h: any) => h.accountAddress)

    // Map for quick amount lookups
    const amountMap = new Map<string, number>(
      holders.map((h: any) => [
        String(h.accountAddress),
        Number(h.humanReadableAmount)
      ])
    )

    ui.content.innerHTML = `<div class="cs-loading">Analyzing ${holders.length} wallets for clusters...</div>`

    // 2. Fetch Clusters
    const clustersData = await fetchClustersByWallets(walletAddresses)
    const clusters = clustersData.clusters || []

    const relevantClusters = clusters.map((cluster: any) => {
      const validMembers = cluster.members
        .filter((m: any) => amountMap.has(m.wallet_address))
        .sort((a: any, b: any) => {
          const amountA = amountMap.get(a.wallet_address) || 0
          const amountB = amountMap.get(b.wallet_address) || 0
          return amountB - amountA
        })

      return { ...cluster, members: validMembers }
    }).filter((c: any) => c.members.length > 0)

    renderResults(ui, relevantClusters, amountMap)

  } catch (err) {
    console.error(err)
    ui.content.innerHTML = `<div class="cs-error">${err instanceof Error ? err.message : 'Unknown Error'}</div>`
  } finally {
    ui.refreshBtn.disabled = false
  }
}

function renderResults(ui: any, clusters: any[], amountMap: Map<string, number>) {
  if (clusters.length === 0) {
    ui.content.innerHTML = `<div class="cs-empty">No shared clusters found among top holders.</div>`
    return
  }

  const html = clusters.map(c => `
    <div class="cs-cluster">
      <div class="cs-cluster-header">
        <span class="cs-cluster-name">${c.cluster_name || 'Unnamed Cluster'}</span>
        <span style="font-size:10px; opacity:0.6">ID: ${c.cluster_id}</span>
      </div>
      <div>
        ${c.members.map((m: any) => `
          <div class="cs-member">
            <span class="cs-member-addr">${m.wallet_address.slice(0, 4)}...${m.wallet_address.slice(-4)}</span>
            <span>${(amountMap.get(m.wallet_address) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  ui.content.innerHTML = html
}


// --- 5. INITIALIZATION ---

(function init() {
  createStyles()
  const ui = createWidgetElements()

  const dragSystem = makeDraggable(ui.container, ui.toggleBtn)

  ui.toggleBtn.addEventListener('click', (e) => {
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

  // Watch for URL changes (SPA navigation)
  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log('[Cluster Scanner] URL changed, resetting...')
      ui.content.innerHTML = `<div class="cs-loading">URL changed. Click Refresh.</div>`
      ui.meta.innerText = ''
    }
  }).observe(document.body, { childList: true, subtree: true })

  console.log('[Cluster Scanner] Ready!')
})()