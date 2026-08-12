# Context: Browser Extension

> Part of the periscanner multi-context project; see `../CONTEXT-MAP.md`. The extension is a thin
> consumer — it renders an in-page overlay from data served by the `scanner-api`
> (`cloudflare-workers`). On-chain and clustering vocabulary is canonical upstream; this glossary
> focuses on the extension's own surface.

A Vue 3 + Tailwind + Vite (Manifest V3) extension. Its content script injects a draggable analysis
overlay on **`axiom.trade`**, reads the token in view, and shows holder concentration, cluster/cabal
risk, insider transfers, dev-rug signals, and copycat tokens.

## Glossary

### Surface / UI

- **Content script** — the script injected into `axiom.trade/*` pages (`src/content/main.ts`). Reads
  the current token from the URL / Axiom local state / DOM and drives the overlay. (There is a popup
  scaffold but it's unimplemented; the product *is* the overlay.)
- **Toggle / panel** — the floating draggable logo button (`.cs-toggle`) and the collapsible analysis
  card (`.cs-panel`) it opens. `Space+1` toggles it. Scans only run while the panel is open (to save
  Helius credits).
- **KPI chips** — the strip of headline metrics (Top-20 hold %, insider %, bonded, dev status,
  created count, OG-token link).
- **Verdict** — the overlay's one-word risk judgement chip: **Clean** / **Caution** / **Cabal Risk** /
  **Rug Risk**, derived from concentration, cluster count, and dev-moved supply (`main.ts`).
- **Cluster card / insider card / member row** — accordion cards rendered per cluster (and per insider
  group not already in a cluster); each member row shows wallet, role, amount, and % of supply
  (`src/content/ui/render.ts`).

### Token resolution

- **Mint** — the canonical SPL token address. **Pool id / pair address** — the Axiom DEX pool in the
  URL, which may *not* equal the mint for brand-new tokens. The scanner resolves mint from URL → Axiom
  `recentTickerSol` state → iframe param → DOM links, with retries for not-yet-indexed tokens
  (`src/content/services/scanner.ts`, `extractTokenAddress.ts`).

### On-chain concepts it displays

- **Token holder / top 20** — largest holders of the mint, excluding known **system wallets**
  (Pump.fun bonding curve, Raydium authority, System/Token programs). Drives the concentration %.
- **Concentration / hold %** — share of total supply held by a wallet, cluster, or the top 20.
- **Cluster / cabal** — a backend-detected coordinated wallet group; the overlay sums **total cluster
  control** (% of supply across all clusters) for its risk verdict. Roles/confidence come from the
  backend (see `supabase-workers/CONTEXT.md` for the canonical role ladder).
- **Insider / insider transfer** — wallets that *received* the token via transfer rather than buying
  it; rendered as `source → insider → relay`. A **deep** insider scan traces multi-hop chains
  (A→B→C); shallow traces only direct transfers.
- **Dev moved %** — share of supply the creator transferred to other personal wallets (the **Rug
  Risk** trigger), distinct from **dev holds %** (still in the dev's wallet).
- **Bonded** — token reached the Pump.fun bonding-curve graduation (~$60k mcap). **Similar tokens** —
  copycats/relaunches matching name/ticker/image (`matchScore` 0–3). **OG token** — the oldest bonded
  match. **Created count** — how many times this token was (re)launched.

### Scan mechanics

- **Scan** — fetch holders, resolve clusters, run dev-check + shallow insiders + similar-tokens (fired
  in parallel against `scanner-api`).
- **Deep scan** — additionally ingests previously-unanalyzed top holders via an async **ingest job**,
  re-clustering them; results **stream in** as the job progresses (polled every ~800ms).
- **Auto mode** — a persisted toggle (`psc_auto_deep`) that auto-runs a deep scan on every token
  navigation, with a longer debounce to skip scrolled-past tokens.
- **Scan generation** — a monotonic counter so fast navigation cancels stale in-flight scans.

## scanner-api calls

Against `…workers.dev/api/v1` (prod) — see `cloudflare-workers/CONTEXT.md` for the server side:
`POST /extension/scan` (top holders + resolved mint), `POST /cluster/by-wallets`,
`POST /extension/insiders` (`deep` toggles multi-hop), `POST /extension/dev-check`,
`POST /extension/similar-tokens`, `POST /jobs` + `GET /jobs/:id` (deep-scan ingest), and
`POST /wallet/ingest-bulk`.

## Avoid

- **Mint ≠ pool id** — the token vs the Axiom DEX pair; they differ on fresh tokens.
- **DB cluster ≠ insider group** — persisted behavioral cluster vs a runtime per-token transfer graph;
  a wallet can appear in both (insiders render as a red overlay badge on cluster rows).
- **Top-20 hold % ≠ total cluster control** — concentration among individual holders vs summed across
  clusters; different thresholds.
- **Confidence score ≠ supply %** — backend membership certainty vs how much the wallet actually
  holds; orthogonal.
- **Dev moved % ≠ dev holds %** — transferred-away (rug signal) vs still-held.
- **Scan ≠ deep scan** — read cached/known data vs ingest+recluster unknown holders.
- Don't treat the **popup** or `HelloWorld.vue` as live product surface — they're unfinished
  scaffolding; the overlay content script is the extension.
