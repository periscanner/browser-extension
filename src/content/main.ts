import { fetchScanResults, fetchClustersByWallets, submitIngestJob, pollIngestJob, fetchSimilarTokens, fetchDevCheck, fetchInsiders } from './services/api'
import type { DevCheckResult, InsiderResult } from './services/api'
import { extractTokenFromUrl, extractMintFromDom, tokenFromAxiomState } from './services/scanner'

import { calculatePercentage } from './utils/format'
import { makeDraggable } from './utils/drag'

import { createStyles } from './ui/styles'
import { createWidgetElements } from './ui/dom'
import { renderResults, renderSimilarTokens, renderInsiders } from './ui/render'

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
let currentSupply: number | null = null
let devCheckData: DevCheckResult | null = null
let currentHolderOwners: string[] = []
let insidersData: InsiderResult | null = null

// Dev moved >= this % of supply to personal (non-market) wallets → RUG ALERT.
const RUG_TRANSFER_PCT = 1

// Auto deep-scan every token on navigation (toggled in the footer, persisted).
let autoDeep = false
// Incremented per scan; stale scans (e.g. fast navigation) bail before rendering.
let scanGen = 0

// % of supply the dev moved to personal (non-market) wallets, 0 if unknown.
function devMovedPct(): number {
  if (!devCheckData || devCheckData.status !== 'ok' || !currentSupply) return 0
  return (devCheckData.transferredToWallets / currentSupply) * 100
}

// Prominent RUG ALERT banner at the top when the dev offloaded supply to wallets.
function renderAlert(ui: any) {
  const moved = devMovedPct()
  if (devCheckData?.status === 'ok' && moved >= RUG_TRANSFER_PCT && devCheckData.devWallet) {
    const n = devCheckData.recipients.length || 1
    ui.alert.className = 'cs-alert cs-alert--danger'
    ui.alert.innerHTML = `<span class="cs-alert-icon">!</span><span><b>RUG RISK</b> — dev moved ${moved.toFixed(1)}% of supply to ${n} wallet${n === 1 ? '' : 's'}</span>`
  } else {
    ui.alert.className = 'cs-alert'
    ui.alert.innerHTML = ''
  }
}

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
  if (devMovedPct() >= RUG_TRANSFER_PCT) {
    // Dev offloading to wallets is the strongest red flag — it overrides.
    vClass = 'cs-verdict--danger'; vLabel = 'Rug Risk'
  } else if (t20 !== null && !Number.isNaN(t20)) {
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

  // Dev status — moved / sold / holds.
  if (devCheckData?.status === 'ok') {
    const moved = devMovedPct()
    const balPct = currentSupply ? (devCheckData.devBalance / currentSupply) * 100 : 0
    const soldPct = currentSupply ? (devCheckData.soldToMarket / currentSupply) * 100 : 0
    let v: string, cls: string
    if (moved >= RUG_TRANSFER_PCT) { v = `moved ${moved.toFixed(1)}%`; cls = 'is-danger' }
    else if (soldPct >= 1) { v = 'sold'; cls = 'is-warn' }
    else if (balPct >= 0.1) { v = `holds ${balPct.toFixed(1)}%`; cls = 'is-muted' }
    else { v = '~0'; cls = 'is-warn' }
    chips.push(chip('Dev', `<span class="cs-mono">${v}</span>`, cls))
  }

  if (currentMarketCap !== null) {
    const bonded = currentMarketCap >= 60000
    chips.push(chip('Bonded', bonded ? 'Yes' : 'No', bonded ? 'is-safe' : 'is-warn'))
  } else {
    chips.push(chip('Bonded', '…'))
  }

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

function switchTab(ui: any, tab: 'clusters' | 'insiders' | 'similar') {
  const panels: Record<string, HTMLElement> = {
    clusters: ui.content,
    insiders: ui.insiderContent,
    similar: ui.similarContent,
  }
  const buttons: Record<string, HTMLElement> = {
    clusters: ui.tabClusters,
    insiders: ui.tabInsiders,
    similar: ui.tabSimilar,
  }
  for (const k of ['clusters', 'insiders', 'similar']) {
    const active = k === tab
    buttons[k].classList.toggle('cs-tab-active', active)
    panels[k].style.display = active ? 'block' : 'none'
  }
}

// Lazy-load the Insider Clusters tab (token-transfer graph among top holders).
// deep = follow the transfer graph multi-hop (A→B→C) instead of just direct.
async function loadInsiders(ui: any, deep = false) {
  if (!currentMint || currentHolderOwners.length === 0) {
    ui.insiderContent.innerHTML = `<div class="cs-empty">Scan a token first.</div>`
    return
  }
  ui.insiderContent.innerHTML = `<div class="cs-loading">${deep ? 'Deep scanning insider transfers (multi-hop)…' : 'Scanning insider transfers…'}</div>`
  try {
    insidersData = await fetchInsiders(currentMint, currentHolderOwners, deep)
    renderInsiders(ui, insidersData.clusters, currentSupply || 0, deep)
    // Wire the "Multi-hop deep scan" button (present only in shallow mode).
    ui.insiderContent.querySelector('#cs-insider-deep')?.addEventListener('click', () => loadInsiders(ui, true))
  } catch (err) {
    console.error('[Cluster Scanner] Insider scan error:', err)
    ui.insiderContent.innerHTML = `<div class="cs-error">Failed to scan insiders.</div>`
  }
}

async function runScan(ui: any, deepScan = false) {
  const myGen = ++scanGen // this scan owns the UI until a newer scan starts
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
  currentSupply = null
  devCheckData = null
  currentHolderOwners = []
  insidersData = null

  // Render initial header/KPIs (loading state) + clear any prior RUG banner
  renderTop(ui)
  renderAlert(ui)
  ui.insiderContent.innerHTML = `<div class="cs-loading">Open this tab to scan insider transfers</div>`

  // --- Resolve the mint instantly from Axiom state; start the scan ASAP -------
  // Axiom's `recentTickerSol` localStorage maps the URL pool id → the real mint
  // (+ name/ticker/image), so we get the canonical mint synchronously with zero
  // network and zero staleness. If it's not in state yet, fall back to the pool
  // id (the worker resolves it). The scan + DexScreener metadata + dev check all
  // run concurrently rather than in a sequential chain.
  let mintAddress = addressFromUrl
  const fromState = tokenFromAxiomState(addressFromUrl)
  if (fromState) {
    mintAddress = fromState.mint
    tokenMetadata = { name: fromState.name || '', symbol: fromState.symbol || '', imageUrl: fromState.image }
  }
  currentMint = mintAddress
  renderTop(ui)

  const scanPromise = fetchScanResults(mintAddress)

  // DexScreener metadata (name / symbol / market cap — display only): fire both
  // lookups at once and update the header when they land. Never blocks the scan.
  void (async () => {
    try {
      const [tok, prs] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressFromUrl}`).then(r => r.json()).catch(() => null),
        fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addressFromUrl}`).then(r => r.json()).catch(() => null),
      ])
      const pair: any = tok?.pairs?.[0] || prs?.pairs?.[0] || prs?.pair || null
      if (pair) {
        tokenMetadata = { name: pair.baseToken.name, symbol: pair.baseToken.symbol, imageUrl: pair.info?.imageUrl }
        currentMarketCap = pair.marketCap || 0
        renderTop(ui)
      }
    } catch { /* metadata is best-effort */ }
  })()

  try {
    // 1. Fetch Top Holders (the worker resolves + returns the canonical mint).
    let scanData: ScanResult | null = await scanPromise.catch(() => null)

    // Fresh tokens: if state didn't have the mint yet and the worker couldn't
    // resolve the pool id, retry — re-reading Axiom state (which populates fast)
    // then the page DOM, backing off while the page finishes loading. This is
    // what stops the "could not find account" RPC error on token entry. Bail if
    // a newer navigation superseded us.
    if (!scanData || !(scanData.holders || []).length) {
      const delays = [250, 500, 900, 1200]
      for (const d of delays) {
        await new Promise(r => setTimeout(r, d))
        if (scanGen !== myGen) return
        const domMint: string | null = tokenFromAxiomState(addressFromUrl)?.mint ?? extractMintFromDom()
        if (domMint && domMint !== addressFromUrl && domMint !== mintAddress) {
          mintAddress = domMint
          const retry = await fetchScanResults(domMint).catch(() => null)
          if (retry && (retry.holders || []).length) { scanData = retry; break }
          scanData = scanData || retry
        }
      }
    }
    if (scanGen !== myGen) return
    if (!scanData || !(scanData.holders || []).length) {
      ui.content.innerHTML = `<div class="cs-error">Couldn't load this token yet — hit Refresh in a moment.</div>`
      return
    }
    console.log('[Cluster Scanner] Scan data:', scanData)

    // Use the worker-resolved mint for the dev check + insiders.
    const realMint = scanData.resolvedMint || mintAddress
    currentMint = realMint
    renderTop(ui)
    // Dev check runs in parallel with the cluster fetch + render below.
    const devCheckPromise = fetchDevCheck(realMint).catch(() => null)

    const holders: TokenHolder[] = scanData.holders || []
    const totalSupply = scanData.stats.totalSupply
    currentSupply = totalSupply

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
    renderTop(ui)

    const walletAddresses = holders.map((h: TokenHolder) => h.owner)
    // Top holders for the (lazy-loaded) Insider Clusters tab.
    currentHolderOwners = nonSystemHolders.map((h: TokenHolder) => h.owner)

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
      // Analyze the 6 largest unknown holders — the ones that matter most for
      // cabal detection — to keep the deep scan fast.
      const candidatesToIngest = unknownHolders.slice(0, 6).map(h => h.owner)

      if (candidatesToIngest.length > 0) {
        ui.content.innerHTML = `<div class="cs-loading">Queuing analysis of ${candidatesToIngest.length} new top holders...</div>`

        try {
          // Submit an async ingestion job (Cloudflare Queues) and poll for progress.
          // The heavy Helius/clustering work runs in the background off the request path.
          const ticket = await submitIngestJob(candidatesToIngest, 'normal')

          // Real-time results: the worker clusters each wallet as its fetch
          // finishes. We poll fast and on EVERY tick re-fetch + re-render the
          // cluster list with whatever's clustered so far — so clusters visibly
          // stream in (and grow) instead of appearing all at once at the end.
          let refreshing = false
          let stopped = false
          const renderLive = async (label: string) => {
            if (refreshing || stopped || scanGen !== myGen) return
            refreshing = true
            try {
              const live = await fetchClustersByWallets(walletAddresses)
              if (stopped) return
              const relevant = processClusters(live.clusters || [], amountMap)
              clusterCount = relevant.length
              renderTop(ui)
              if (relevant.length) {
                renderResults(ui, relevant, amountMap, totalSupply)
                ui.content.insertAdjacentHTML('afterbegin', `<div class="cs-loading" style="padding:8px 2px">${label}</div>`)
              } else {
                ui.content.innerHTML = `<div class="cs-loading">${label}</div>`
              }
            } catch { /* keep last good render */ }
            finally { refreshing = false }
          }

          await pollIngestJob(ticket.jobId, (_progress, processed, total) => {
            const totalCount = total ?? candidatesToIngest.length
            const label = processed > 0
              ? `Analyzing top holders… ${processed}/${totalCount}`
              : 'Analyzing top holders…'
            void renderLive(label)
          }, { intervalMs: 800 })

          // Final authoritative refresh once the job completes.
          stopped = true
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
    if (scanGen !== myGen) return // a newer scan (e.g. fast navigation) took over
    console.log('[Cluster Scanner] Raw clusters:', clusters)

    const relevantClusters = processClusters(clusters, amountMap)
    clusterCount = relevantClusters.length
    renderTop(ui)

    renderResults(ui, relevantClusters, amountMap, totalSupply)

    // Resolve the parallel dev rug check and surface it (banner + verdict + chip).
    devCheckData = await devCheckPromise
    renderAlert(ui)
    renderTop(ui)

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

  // Auto deep-scan toggle (persisted): when on, navigating to a token auto-runs
  // the deep scan instead of a normal scan, for faster hands-off research.
  const updateAutoBtn = () => ui.autoBtn.classList.toggle('is-on', autoDeep)
  try {
    chrome.storage?.local.get(['psc_auto_deep'], (r: any) => {
      autoDeep = !!r?.psc_auto_deep
      updateAutoBtn()
    })
  } catch { /* storage unavailable */ }

  ui.autoBtn.addEventListener('click', () => {
    autoDeep = !autoDeep
    updateAutoBtn()
    try { chrome.storage?.local.set({ psc_auto_deep: autoDeep }) } catch { /* ignore */ }
    // Turning it on while viewing a token kicks off a deep scan right away.
    if (autoDeep && extractTokenFromUrl()) runScan(ui, true)
  })

  function toggleWidget() {
    const isClosed = ui.panel.style.display === 'none' || ui.panel.style.display === ''
    if (isClosed) {
      ui.panel.style.display = 'flex'
      if (ui.content.innerText.includes('Click to scan')) {
        runScan(ui, autoDeep)
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

  ui.tabInsiders.addEventListener('click', () => {
    switchTab(ui, 'insiders')
    // Lazy-load on first open (cached for the rest of the scan).
    if (insidersData === null) {
      loadInsiders(ui)
    }
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
      currentSupply = null
      devCheckData = null
      currentHolderOwners = []
      insidersData = null
      ui.similarContent.innerHTML = `<div class="cs-loading">Scan a token first</div>`
      ui.insiderContent.innerHTML = `<div class="cs-loading">Scan a token first</div>`
      renderTop(ui)
      renderAlert(ui)

      // Switch back to clusters tab
      switchTab(ui, 'clusters')

      const address = extractTokenFromUrl()
      if (address) {
        // Auto-scan the new token — deep scan if the user enabled Auto mode.
        runScan(ui, autoDeep)
      } else {
        ui.content.innerHTML = `<div class="cs-loading">Navigate to a Token Page to scan.</div>`
      }
    }
  }).observe(document.body, { childList: true, subtree: true })

  console.log('[Cluster Scanner] Ready!')
})()
