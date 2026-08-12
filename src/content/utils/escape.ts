// Shared HTML-injection hardening for the content-script UI.
//
// Token/coin metadata (name, symbol, image URL) and any link derived from it
// are fully attacker-controlled — anyone can mint a Solana token with
// adversarial metadata, and the extension's similar-tokens/lineage matching
// surfaces those tokens inside a popular coin's own UI for every viewer.
// This markup is injected straight into axiom.trade's own document via
// innerHTML, so every interpolated value sourced from the API MUST be
// escaped. Used by both ogStrip.ts and render.ts — do not duplicate.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Only ever accept a genuine http(s) URL — anything else (javascript:, data:,
// malformed) is rejected. Shared by <img src> hardening (falls back to a
// letter-glyph avatar) and any <a>/data-*-link href built from API data
// (falls back to omitting the attribute, so callers' `if (href)` guards turn
// a click into a no-op instead of navigating to something unsafe).
export function safeHttpUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

// Alias kept for call-site clarity where the value specifically becomes an
// <img src> (ogStrip.ts's original name — behaviour unchanged).
export const safeImageUrl = safeHttpUrl
