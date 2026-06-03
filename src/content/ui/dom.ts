// Bundle the logo with the extension (no remote-storage dependency).
// Vite emits a root-relative path (e.g. "/assets/…svg"); inside a content
// script that would resolve against the host page (axiom.trade) and 404, so
// resolve it to a chrome-extension:// URL. The asset is in web_accessible_resources.
import logoUrl from '../../assets/LOGO_CIRCLE_TRANSPARENT_100x100.svg'

const logoSrc = chrome.runtime.getURL(logoUrl)

export function createWidgetElements() {
  const widget = document.createElement('div')
  widget.id = 'cluster-scanner-widget'
  widget.innerHTML = `
    <button id="cs-toggle" class="cs-toggle" title="Drag to move, click to toggle">
      <img src="${logoSrc}" alt="Scanner" />
    </button>
    <div id="cs-panel" class="cs-panel">
      <div class="cs-header">
        <h3>Periscanner</h3>
        <button id="cs-close" class="cs-close">×</button>
      </div>
      <div id="cs-summary" class="cs-summary" style="display: none;"></div>
      <div class="cs-tabs">
        <button id="cs-tab-clusters" class="cs-tab cs-tab-active">Clusters</button>
        <button id="cs-tab-similar" class="cs-tab">Similar Tokens</button>
      </div>
      <div id="cs-stats" class="cs-stats"></div>
      <div id="cs-content" class="cs-content">
        <div class="cs-loading">Click Refresh to scan</div>
      </div>
      <div id="cs-similar-content" class="cs-content" style="display: none;">
        <div class="cs-loading">Click Refresh to scan</div>
      </div>
      <div class="cs-footer">
        <button id="cs-refresh" class="cs-refresh">Refresh Scan</button>
        <button id="cs-deep-analyze" class="cs-deep-analyze" title="Analyze unknown top holders">Deep Scan</button>
      </div>
    </div>
  `
  document.body.appendChild(widget)
  return {
    container: widget,
    toggleBtn: widget.querySelector('#cs-toggle') as HTMLElement,
    panel: widget.querySelector('#cs-panel') as HTMLElement,
    closeBtn: widget.querySelector('#cs-close') as HTMLElement,
    summary: widget.querySelector('#cs-summary') as HTMLElement,
    stats: widget.querySelector('#cs-stats') as HTMLElement,
    content: widget.querySelector('#cs-content') as HTMLElement,
    similarContent: widget.querySelector('#cs-similar-content') as HTMLElement,
    refreshBtn: widget.querySelector('#cs-refresh') as HTMLButtonElement,
    deepAnalyzeBtn: widget.querySelector('#cs-deep-analyze') as HTMLButtonElement,
    tabClusters: widget.querySelector('#cs-tab-clusters') as HTMLButtonElement,
    tabSimilar: widget.querySelector('#cs-tab-similar') as HTMLButtonElement
  }
}
