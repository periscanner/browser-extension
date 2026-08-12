export function createStyles() {
  const style = document.createElement('style')
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&display=swap');

    /* ===== Periscanner widget — compact trader dashboard =====
       Design system ported from AIDesigner artifact:
       zinc surfaces, azure primary (#0ea5e9), coral danger (#f43f5e),
       Geist / Geist Mono, dense tabular-number layout. All rules are
       scoped to #cluster-scanner-widget so nothing leaks onto the host. */

    #cluster-scanner-widget {
      --ps-bg: #111113;
      --ps-bg-soft: rgba(24, 24, 27, 0.4);
      --ps-bg-2: #18181b;
      --ps-surface: rgba(24, 24, 27, 0.3);
      --ps-border: #27272a;
      --ps-border-soft: rgba(39, 39, 42, 0.6);
      --ps-azure: #0ea5e9;
      --ps-azure-hi: #38bdf8;
      --ps-coral: #f43f5e;
      --ps-amber: #f59e0b;
      --ps-emerald: #34d399;
      --ps-z100: #f4f4f5;
      --ps-z200: #e4e4e7;
      --ps-z300: #d4d4d8;
      --ps-z400: #a1a1aa;
      --ps-z500: #71717a;
      --ps-z600: #52525b;
      --ps-z700: #3f3f46;

      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      touch-action: none;
      user-select: none;
    }

    #cluster-scanner-widget *,
    #cluster-scanner-widget *::before,
    #cluster-scanner-widget *::after {
      box-sizing: border-box;
      margin: 0;
    }

    .cs-mono {
      font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    /* ---- Toggle (floating logo) ---- */
    .cs-toggle {
      width: 52px;
      height: 52px;
      background: var(--ps-bg-2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
      transition: transform 0.1s;
      border: 1px solid var(--ps-border);
      padding: 0;
      overflow: hidden;
    }
    .cs-toggle:active { cursor: grabbing; transform: scale(0.95); }
    .cs-toggle img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }

    /* ---- Panel shell ---- */
    .cs-panel {
      position: absolute;
      bottom: 64px;
      right: 0;
      width: 420px;
      max-height: 640px;
      background: var(--ps-bg);
      border-radius: 12px;
      box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.8),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05);
      display: none;
      flex-direction: column;
      border: 1px solid var(--ps-border);
      overflow: hidden;
      color: var(--ps-z300);
      font-size: 12px;
      line-height: 1.4;
    }

    /* ---- Header ---- */
    .cs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 12px;
      height: 50px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--ps-border-soft);
      background: rgba(24, 24, 27, 0.4);
    }
    .cs-token { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .cs-token-avatar {
      position: relative; width: 28px; height: 28px; flex-shrink: 0;
    }
    .cs-token-avatar img {
      width: 28px; height: 28px; border-radius: 50%;
      object-fit: cover; border: 1px solid var(--ps-border);
      background: var(--ps-bg-2);
    }
    .cs-token-avatar .cs-token-glyph {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--ps-border); background: var(--ps-bg-2);
      color: var(--ps-z500);
    }
    .cs-token-dot {
      position: absolute; bottom: -1px; right: -1px;
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--ps-emerald); border: 2px solid var(--ps-bg);
    }
    .cs-token-meta { display: flex; flex-direction: column; min-width: 0; }
    .cs-token-symbol {
      font-size: 13px; font-weight: 600; color: var(--ps-z100);
      letter-spacing: -0.01em; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;
    }
    .cs-token-mint { font-size: 10px; color: var(--ps-z500); }
    .cs-header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

    .cs-verdict {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 8px; border-radius: 5px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; white-space: nowrap;
      border: 1px solid transparent;
    }
    .cs-verdict-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .cs-verdict--danger  { color: var(--ps-coral);  background: rgba(244, 63, 94, 0.1);  border-color: rgba(244, 63, 94, 0.22); }
    .cs-verdict--warn    { color: var(--ps-amber);  background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.22); }
    .cs-verdict--safe    { color: var(--ps-emerald);background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.22); }
    .cs-verdict--neutral { color: var(--ps-z400);   background: rgba(63, 63, 70, 0.4);   border-color: var(--ps-border); }

    .cs-close {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 5px;
      background: none; border: none; color: var(--ps-z500);
      font-size: 18px; cursor: pointer; transition: all 0.15s; line-height: 1;
    }
    .cs-close:hover { color: var(--ps-z200); background: var(--ps-bg-2); }

    /* ---- RUG alert banner ---- */
    .cs-alert {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      border-bottom: 1px solid var(--ps-border-soft);
    }
    .cs-alert--danger {
      display: flex;
      color: #fda4af;
      background: rgba(244, 63, 94, 0.14);
      border-bottom-color: rgba(244, 63, 94, 0.28);
      box-shadow: inset 0 0 24px rgba(244, 63, 94, 0.08);
    }
    .cs-alert b { color: #fb7185; font-weight: 700; letter-spacing: 0.02em; }
    .cs-alert-icon {
      flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--ps-coral); color: #1a0509; font-size: 12px; font-weight: 800;
    }

    /* ---- KPI strip ---- */
    .cs-kpis {
      display: flex; gap: 0;
      padding: 10px 12px;
      overflow-x: auto;
      flex-shrink: 0;
      border-bottom: 1px solid var(--ps-border-soft);
      background: rgba(24, 24, 27, 0.2);
    }
    .cs-kpi {
      display: flex; flex-direction: column; gap: 3px;
      padding-right: 14px; margin-right: 14px;
      border-right: 1px solid var(--ps-border);
      white-space: nowrap; flex-shrink: 0;
    }
    .cs-kpi:last-child { border-right: none; margin-right: 0; padding-right: 0; }
    .cs-kpi-label {
      font-size: 9px; font-weight: 500; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--ps-z500);
    }
    .cs-kpi-value {
      font-size: 12px; font-weight: 500; color: var(--ps-z300);
      display: inline-flex; align-items: center; gap: 4px;
    }
    .cs-kpi-value.is-danger { color: var(--ps-coral); }
    .cs-kpi-value.is-warn   { color: var(--ps-amber); }
    .cs-kpi-value.is-safe   { color: var(--ps-emerald); }
    .cs-kpi-value.is-muted  { color: var(--ps-z400); }
    .cs-kpi-link {
      color: var(--ps-azure); text-decoration: none; font-weight: 600;
      border-bottom: 1px dashed rgba(14, 165, 233, 0.4);
    }
    .cs-kpi-link:hover { color: var(--ps-azure-hi); }

    /* ---- Tabs ---- */
    .cs-tabs { padding: 8px 12px; flex-shrink: 0; border-bottom: 1px solid var(--ps-border-soft); background: rgba(24, 24, 27, 0.4); }
    .cs-tabs-seg {
      display: flex; width: 100%;
      background: rgba(9, 9, 11, 0.5);
      border: 1px solid var(--ps-border-soft);
      border-radius: 6px; padding: 2px;
    }
    .cs-tab {
      flex: 1; padding: 5px 8px;
      background: none; border: none; border-radius: 4px;
      color: var(--ps-z500); cursor: pointer;
      font-family: inherit; font-size: 11px; font-weight: 500;
      transition: all 0.15s;
    }
    .cs-tab:hover { color: var(--ps-z300); }
    .cs-tab-active { color: var(--ps-z100); background: var(--ps-border); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }

    /* ---- Scroll areas ---- */
    .cs-content, .cs-similar {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 12px; color: var(--ps-z300);
      max-height: 420px;
    }
    .cs-content::-webkit-scrollbar, .cs-similar::-webkit-scrollbar { width: 5px; }
    .cs-content::-webkit-scrollbar-thumb, .cs-similar::-webkit-scrollbar-thumb { background: var(--ps-z700); border-radius: 4px; }
    .cs-content::-webkit-scrollbar-track, .cs-similar::-webkit-scrollbar-track { background: transparent; }

    .cs-loading { padding: 24px; text-align: center; color: var(--ps-z400); font-size: 12px; }
    .cs-error { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); color: #fda4af; padding: 10px 12px; border-radius: 6px; font-size: 12px; }
    .cs-empty { text-align: center; color: var(--ps-z500); padding: 24px; font-size: 12px; }

    /* ---- Cabal control summary bar ---- */
    .cs-cabal {
      display: flex; flex-direction: column; gap: 6px;
      padding: 0 2px 4px;
      margin-bottom: 12px;
    }
    .cs-cabal-head { display: flex; justify-content: space-between; align-items: baseline; }
    .cs-cabal-label { font-size: 10px; color: var(--ps-z400); }
    .cs-cabal-value { font-size: 12px; font-weight: 500; }
    .cs-cabal-track { height: 6px; width: 100%; background: var(--ps-border); border-radius: 999px; overflow: hidden; display: flex; }
    .cs-cabal-seg { height: 100%; }

    /* ---- Cluster card ---- */
    .cs-cluster { border: 1px solid var(--ps-border); border-radius: 8px; overflow: hidden; margin-bottom: 12px; background: var(--ps-surface); }
    .cs-cluster:last-child { margin-bottom: 0; }
    .cs-cluster--danger { border-color: rgba(244, 63, 94, 0.22); background: rgba(244, 63, 94, 0.02); }
    .cs-cluster--warn   { border-color: rgba(245, 158, 11, 0.22); background: rgba(245, 158, 11, 0.02); }
    .cs-cluster--low    { border-color: var(--ps-border); background: rgba(24, 24, 27, 0.2); }

    .cs-cluster-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 12px; cursor: pointer; user-select: none;
      background: rgba(24, 24, 27, 0.3); transition: background 0.12s;
    }
    .cs-cluster-head:hover { background: rgba(24, 24, 27, 0.55); }
    .cs-cluster-title { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .cs-cluster-sev { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
    .cs-cluster-name {
      font-size: 12px; font-weight: 500; color: var(--ps-z200);
      text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
    }
    a.cs-cluster-name:hover { text-decoration: underline; }
    .cs-cluster-count {
      font-size: 10px; color: var(--ps-z500); flex-shrink: 0;
      background: var(--ps-bg-2); border: 1px solid var(--ps-border);
      border-radius: 999px; padding: 0 6px; line-height: 16px;
    }
    .cs-cluster-head-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .cs-cluster-pct { font-size: 12px; font-weight: 600; flex-shrink: 0; }
    .cs-cluster-chevron { width: 13px; height: 13px; color: var(--ps-z500); transition: transform 0.18s; flex-shrink: 0; }

    /* Accordion: collapsed by default, expand on .is-open */
    .cs-cluster-body { display: none; border-top: 1px solid var(--ps-border-soft); }
    .cs-cluster.is-open > .cs-cluster-head { background: rgba(24, 24, 27, 0.55); }
    .cs-cluster.is-open .cs-cluster-body { display: block; }
    .cs-cluster.is-open .cs-cluster-chevron { transform: rotate(180deg); }

    .cs-thead {
      display: grid; grid-template-columns: 64px 1fr 70px 46px;
      gap: 6px; padding: 6px 12px;
      font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--ps-z500); background: rgba(9, 9, 11, 0.2);
      border-bottom: 1px solid var(--ps-border-soft);
    }
    .cs-thead > :nth-child(3), .cs-thead > :nth-child(4) { text-align: right; }

    .cs-row {
      display: grid; grid-template-columns: 64px 1fr 70px 46px;
      gap: 6px; padding: 7px 12px; align-items: center;
      border-bottom: 1px solid var(--ps-border-soft);
      transition: background 0.12s;
    }
    .cs-row:last-child { border-bottom: none; }
    .cs-row:hover { background: rgba(63, 63, 70, 0.18); }
    .cs-row-addr { font-size: 10px; color: var(--ps-z400); cursor: pointer; transition: color 0.12s; }
    .cs-row-addr:hover { color: var(--ps-z100); }
    .cs-row-role {
      justify-self: start; font-size: 9px; font-weight: 500;
      padding: 2px 6px; border-radius: 4px;
      background: var(--ps-bg-2); border: 1px solid var(--ps-border); color: var(--ps-z300);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }
    .cs-row-role--accent { background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); color: var(--ps-coral); }
    .cs-row-role--warn   { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: var(--ps-amber); }
    .cs-row-amount { font-size: 10px; color: var(--ps-z300); text-align: right; }
    .cs-row-supply { font-size: 10px; text-align: right; }
    .cs-row-more {
      padding: 7px 12px; font-size: 10px; color: var(--ps-z500); font-style: italic;
      text-align: center; background: rgba(9, 9, 11, 0.2);
    }

    /* ---- Insider overlay (red) on cluster rows + standalone insider cards ---- */
    .cs-cluster--insider { border-color: rgba(244, 63, 94, 0.32); background: rgba(244, 63, 94, 0.03); }
    .cs-row--insider { background: rgba(244, 63, 94, 0.07); }
    .cs-row--insider:hover { background: rgba(244, 63, 94, 0.13); }
    .cs-row-role--insider { background: rgba(244, 63, 94, 0.13); border-color: rgba(244, 63, 94, 0.3); color: #fb7185; }
    .cs-cluster-insider-badge {
      font-size: 9px; font-weight: 600; color: #fb7185; flex-shrink: 0; white-space: nowrap;
      background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.25);
      border-radius: 999px; padding: 1px 7px; line-height: 15px;
    }

    /* ---- Section divider (e.g. Insider transfers) inside the clusters panel ---- */
    .cs-section { margin-top: 18px; padding-top: 6px; border-top: 1px solid var(--ps-border-soft); }
    .cs-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 6px 2px 12px; }
    .cs-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ps-coral); }

    /* ---- Insider control bar ---- */
    .cs-insider-bar { display: flex; justify-content: flex-end; margin-bottom: 10px; }
    .cs-insider-deep {
      font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
      color: var(--ps-azure); background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 6px; padding: 5px 10px;
      transition: all 0.12s;
    }
    .cs-insider-deep:hover { background: rgba(14, 165, 233, 0.18); color: var(--ps-azure-hi); }
    .cs-insider-deep:disabled { opacity: 0.5; cursor: not-allowed; }
    .cs-insider-badge {
      font-size: 10px; font-weight: 600; color: var(--ps-azure);
      background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.25);
      border-radius: 6px; padding: 4px 9px;
    }

    /* ---- Similar tokens ---- */
    .cs-sim-note { font-size: 11px; color: var(--ps-z400); padding: 0 2px 8px; line-height: 1.4; }
    .cs-sim {
      display: flex; align-items: center; gap: 10px;
      padding: 8px; margin-bottom: 6px; cursor: pointer;
      background: rgba(24, 24, 27, 0.4);
      border: 1px solid var(--ps-border-soft); border-radius: 8px;
      transition: background 0.12s;
    }
    .cs-sim:last-child { margin-bottom: 0; }
    .cs-sim:hover { background: rgba(63, 63, 70, 0.25); }
    .cs-sim--danger { border-color: rgba(244, 63, 94, 0.3); box-shadow: inset 0 0 20px rgba(244, 63, 94, 0.05); }
    .cs-sim--warn   { border-color: rgba(245, 158, 11, 0.28); }
    .cs-sim-rank { width: 20px; flex-shrink: 0; text-align: center; font-size: 10px; font-weight: 700; color: var(--ps-z500); }
    .cs-sim-rank--og { color: var(--ps-amber); }
    .cs-sim-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--ps-border); flex-shrink: 0; background: var(--ps-bg-2); }
    .cs-sim-glyph { display: flex; align-items: center; justify-content: center; color: var(--ps-z500); font-size: 14px; }
    .cs-sim-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .cs-sim-top { display: flex; align-items: center; gap: 6px; }
    .cs-sim-name { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--ps-z200); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cs-sim-you { font-size: 9px; font-weight: 700; color: var(--ps-azure); background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 4px; padding: 1px 5px; white-space: nowrap; flex-shrink: 0; }
    .cs-sim-badge { flex-shrink: 0; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
    .cs-sim-badge--danger { color: var(--ps-coral); background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); }
    .cs-sim-badge--safe { color: var(--ps-emerald); background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.2); }
    .cs-sim-meta { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--ps-z500); }
    .cs-sim-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ps-z600); }
    .cs-sim-date { font-size: 9px; color: var(--ps-z600); margin-top: 1px; }
    .cs-sim-matches { display: flex; gap: 4px; flex-shrink: 0; }
    .cs-sim-chip {
      font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      padding: 2px 5px; border-radius: 4px; border: 1px solid var(--ps-border); color: var(--ps-z600);
    }
    .cs-sim-chip.on { color: var(--ps-coral); border-color: rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.08); }
    .cs-sim-copy {
      flex-shrink: 0; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid var(--ps-border); background: transparent; color: var(--ps-z500);
      cursor: pointer; font-size: 11px; line-height: 1; transition: all 0.12s;
    }
    .cs-sim-copy:hover { color: var(--ps-z100); border-color: var(--ps-z600); background: rgba(63, 63, 70, 0.25); }
    .cs-sim-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 2px 2px; font-size: 10px; color: var(--ps-z500); }
    .cs-sim-toggle {
      font-family: inherit; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;
      color: var(--ps-azure); background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 6px; padding: 4px 8px;
      transition: all 0.12s;
    }
    .cs-sim-toggle:hover { background: rgba(14, 165, 233, 0.18); color: var(--ps-azure-hi); }

    /* ---- Footer ---- */
    .cs-footer {
      display: flex; gap: 8px; padding: 10px 12px;
      flex-shrink: 0; border-top: 1px solid var(--ps-border-soft);
      background: rgba(24, 24, 27, 0.8);
    }
    .cs-refresh {
      width: 38px; height: 38px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--ps-bg-2); color: var(--ps-z300);
      border: 1px solid var(--ps-border); border-radius: 8px;
      cursor: pointer; transition: all 0.12s;
    }
    .cs-refresh:hover { background: var(--ps-border); }
    .cs-refresh svg { width: 16px; height: 16px; }
    .cs-auto {
      height: 38px; flex-shrink: 0;
      display: flex; align-items: center; gap: 5px; padding: 0 10px;
      background: var(--ps-bg-2); color: var(--ps-z400);
      border: 1px solid var(--ps-border); border-radius: 8px;
      font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
      transition: all 0.12s;
    }
    .cs-auto svg { width: 13px; height: 13px; }
    .cs-auto:hover { background: var(--ps-border); color: var(--ps-z200); }
    .cs-auto.is-on {
      color: var(--ps-azure); background: rgba(14, 165, 233, 0.12);
      border-color: rgba(14, 165, 233, 0.35);
    }
    .cs-auto:active { transform: scale(0.97); }

    .cs-deep-analyze {
      flex: 1; height: 38px;
      display: flex; align-items: center; justify-content: center; gap: 7px;
      background: var(--ps-azure); color: #09090b;
      border: none; border-radius: 8px;
      font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: 0 0 16px -3px rgba(14, 165, 233, 0.4);
      transition: all 0.12s;
    }
    .cs-deep-analyze:hover { background: var(--ps-azure-hi); }
    .cs-deep-analyze svg { width: 15px; height: 15px; }
    .cs-refresh:disabled, .cs-deep-analyze:disabled { opacity: 0.5; cursor: not-allowed; }
    .cs-refresh:active, .cs-deep-analyze:active { transform: scale(0.97); }

    /* ---- Toast (appended to body, kept global) ---- */
    .cs-toast {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
      background: #09090b; color: #f4f4f5; padding: 10px 20px;
      border: 1px solid #27272a; border-radius: 8px;
      font-family: 'Geist', -apple-system, sans-serif; font-size: 13px; font-weight: 600;
      z-index: 2147483647; opacity: 0; transition: opacity 0.25s; pointer-events: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    .cs-toast.visible { opacity: 1; }
  `
  document.head.appendChild(style)
}
