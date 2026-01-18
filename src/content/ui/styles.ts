export function createStyles() {
  const style = document.createElement('style')
  style.textContent = `
    #cluster-scanner-widget {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
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
      background: rgba(15, 23, 42, 0.7);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: none;
      flex-direction: column;
      border: 1px solid #1e293b;
      backdrop-filter: blur(8px);
    }

    .cs-panel.visible { display: flex; }

    .cs-header {
      padding: 8px;
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

    .cs-summary {
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.5);
      border-bottom: 1px solid #334155;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 11px;
    }

    .cs-summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: rgba(15, 23, 42, 0.4);
      border-radius: 6px;
    }

    .cs-summary-label {
      color: #64748b;
      font-weight: 500;
    }

    .cs-summary-value {
      color: #e2e8f0;
      font-weight: 600;
    }

    .cs-summary-bonded-yes {
      color: #10b981;
      font-size: 14px;
    }

    .cs-summary-bonded-no {
      color: #ef4444;
      font-size: 14px;
    }

    .cs-summary-og-btn {
      background: #2563eb;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 10px;
      font-weight: 600;
      transition: background 0.2s;
      display: inline-block;
    }

    .cs-summary-og-btn:hover {
      background: #1d4ed8;
    }

    .cs-summary-item.full-width {
      grid-column: 1 / -1;
    }

    .cs-tabs {
      display: flex;
      gap: 0;
      background: #0f172a;
      border-bottom: 1px solid #334155;
    }

    .cs-tab {
      flex: 1;
      padding: 12px;
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .cs-tab:hover {
      color: #94a3b8;
      background: rgba(51, 65, 85, 0.3);
    }

    .cs-tab-active {
      color: #60a5fa;
      border-bottom-color: #60a5fa;
      background: rgba(96, 165, 250, 0.1);
    }

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

    .cs-cluster-name-link {
      text-decoration: none;
      color: inherit;
    }

    .cs-cluster-name-link:hover .cs-cluster-name {
      text-decoration: underline;
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
      cursor: pointer;
      transition: color 0.2s;
    }

    .cs-member-addr:hover {
      color: #60a5fa;
      text-decoration: underline;
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
    
    .cs-footer {
      padding: 10px;
      display: flex;
      gap: 10px;
      border-top: 1px solid #334155;
    }

    .cs-refresh, .cs-deep-analyze {
      flex: 1;
      padding: 10px; 
      color: white; 
      border: none; 
      border-radius: 6px; 
      cursor: pointer; 
      font-weight: 600;
      font-size: 12px;
      transition: opacity 0.2s;
    }

    .cs-refresh { background: #334155; }
    .cs-deep-analyze { background: #2563eb; }
    
    .cs-refresh:disabled, .cs-deep-analyze:disabled { 
      opacity: 0.5; 
      cursor: not-allowed; 
    }

    .cs-meta {
      font-size: 10px;
      color: #64748b;
      padding: 0 16px 8px;
      text-align: right;
    }

    .cs-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #020618;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      box-shadow: 0 8px 16px rgba(0,0,0,0.2);
    }
    .cs-toast.visible { opacity: 1; }

    .cs-similar-token {
      margin-bottom: 12px;
      background: rgba(30, 41, 59, 0.3);
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #334155;
    }

    .cs-similar-token-high-risk {
      border: 2px solid #dc2626;
      background: rgba(220, 38, 38, 0.1);
    }

    .cs-similar-token-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .cs-similar-token-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cs-similar-token-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cs-similar-token-image {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .cs-similar-token-name {
      font-weight: bold;
      color: #e2e8f0;
      font-size: 13px;
    }

    .cs-similar-token-symbol {
      color: #94a3b8;
      font-size: 11px;
    }

    .cs-bonded-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      font-size: 9px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 2px;
    }

    .cs-similar-token-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .cs-similar-token-date {
      color: #64748b;
      font-size: 10px;
    }

    .cs-similar-token-mcap {
      color: #fbbf24;
      font-size: 12px;
      font-weight: 600;
    }

    .cs-similar-token-matches {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
      padding: 8px;
      background: rgba(15, 23, 42, 0.4);
      border-radius: 6px;
    }

    .cs-match-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;
      cursor: default;
    }

    .cs-match-checkbox input[type="checkbox"] {
      cursor: default;
      margin: 0;
    }

    .cs-match-checkbox input[type="checkbox"]:checked {
      accent-color: #10b981;
    }

    .cs-similar-token-actions {
      display: flex;
      gap: 8px;
    }

    .cs-similar-token-link {
      flex: 1;
      text-align: center;
      padding: 8px;
      background: #334155;
      color: #60a5fa;
      text-decoration: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      transition: background 0.2s;
    }

    .cs-similar-token-link:hover {
      background: #475569;
    }
  `
  document.head.appendChild(style)
}
