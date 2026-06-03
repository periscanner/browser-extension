// Bundle the logo with the extension (no remote-storage dependency).
// Vite emits a root-relative path (e.g. "/assets/…svg"); inside a content
// script that would resolve against the host page (axiom.trade) and 404, so
// resolve it to a chrome-extension:// URL. The asset is in web_accessible_resources.
import logoUrl from '../../assets/LOGO_CIRCLE_TRANSPARENT_100x100.svg'

const logoSrc = chrome.runtime.getURL(logoUrl)

const REFRESH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/></svg>`
const RADAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`

export function createWidgetElements() {
  const widget = document.createElement('div')
  widget.id = 'cluster-scanner-widget'
  widget.innerHTML = `
    <button id="cs-toggle" class="cs-toggle" title="Drag to move · click or Space+1 to toggle">
      <img src="${logoSrc}" alt="Scanner" />
    </button>
    <div id="cs-panel" class="cs-panel">
      <header class="cs-header">
        <div id="cs-token" class="cs-token">
          <div class="cs-token-avatar">
            <div class="cs-token-glyph">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
            </div>
          </div>
          <div class="cs-token-meta">
            <span class="cs-token-symbol">Periscanner</span>
            <span class="cs-token-mint">no token loaded</span>
          </div>
        </div>
        <div class="cs-header-right">
          <span id="cs-verdict" class="cs-verdict cs-verdict--neutral"><span class="cs-verdict-dot"></span>Scan</span>
          <button id="cs-close" class="cs-close" title="Close (Space+1)">&times;</button>
        </div>
      </header>

      <div id="cs-alert" class="cs-alert"></div>

      <div id="cs-summary" class="cs-kpis"></div>

      <div class="cs-tabs">
        <div class="cs-tabs-seg">
          <button id="cs-tab-clusters" class="cs-tab cs-tab-active">Clusters</button>
          <button id="cs-tab-insiders" class="cs-tab">Insiders</button>
          <button id="cs-tab-similar" class="cs-tab">Similar</button>
        </div>
      </div>

      <div id="cs-content" class="cs-content">
        <div class="cs-loading">Click to scan this token</div>
      </div>
      <div id="cs-insider-content" class="cs-content" style="display: none;">
        <div class="cs-loading">Scan a token first</div>
      </div>
      <div id="cs-similar-content" class="cs-similar" style="display: none;">
        <div class="cs-loading">Scan a token first</div>
      </div>

      <div class="cs-footer">
        <button id="cs-refresh" class="cs-refresh" title="Refresh scan">${REFRESH_SVG}</button>
        <button id="cs-deep-analyze" class="cs-deep-analyze" title="Analyze unknown top holders">${RADAR_SVG}<span>Deep Scan</span></button>
      </div>
    </div>
  `
  document.body.appendChild(widget)
  return {
    container: widget,
    toggleBtn: widget.querySelector('#cs-toggle') as HTMLElement,
    panel: widget.querySelector('#cs-panel') as HTMLElement,
    closeBtn: widget.querySelector('#cs-close') as HTMLElement,
    token: widget.querySelector('#cs-token') as HTMLElement,
    verdict: widget.querySelector('#cs-verdict') as HTMLElement,
    alert: widget.querySelector('#cs-alert') as HTMLElement,
    summary: widget.querySelector('#cs-summary') as HTMLElement,
    content: widget.querySelector('#cs-content') as HTMLElement,
    insiderContent: widget.querySelector('#cs-insider-content') as HTMLElement,
    similarContent: widget.querySelector('#cs-similar-content') as HTMLElement,
    refreshBtn: widget.querySelector('#cs-refresh') as HTMLButtonElement,
    deepAnalyzeBtn: widget.querySelector('#cs-deep-analyze') as HTMLButtonElement,
    tabClusters: widget.querySelector('#cs-tab-clusters') as HTMLButtonElement,
    tabInsiders: widget.querySelector('#cs-tab-insiders') as HTMLButtonElement,
    tabSimilar: widget.querySelector('#cs-tab-similar') as HTMLButtonElement
  }
}
