import { LOGO_PATH } from '../config'

export function createWidgetElements() {
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
    stats: widget.querySelector('#cs-stats') as HTMLElement,
    content: widget.querySelector('#cs-content') as HTMLElement,
    refreshBtn: widget.querySelector('#cs-refresh') as HTMLButtonElement,
    deepAnalyzeBtn: widget.querySelector('#cs-deep-analyze') as HTMLButtonElement
  }
}
