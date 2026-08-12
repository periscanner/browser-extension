// Runs in Axiom's MAIN world (see manifest.config.ts — `world: 'MAIN'`,
// `run_at: 'document_start'`). Content scripts normally execute in an
// isolated world and cannot see the page's own `window.next`, so this tiny
// bridge does the actual same-tab SPA navigation on behalf of the isolated
// content script (ui/ogStrip.ts). It listens for a `psc:navigate` CustomEvent
// dispatched on `window` with `detail.path` (e.g. "/meme/<mint>?chain=sol").
//
// Verified live (content fingerprint of the rendered token header, excluding
// our own injected strip): `router.push`/`replace` change the URL but leave
// the view frozen on the old token, and `router.push` + `router.refresh()`
// fires dozens of requests yet never repaints. Only `history.pushState` + a
// synthetic `popstate` actually swaps the rendered token (~2s, no reload).
// Axiom's own row-click handler (recovered from its React fiber) does a
// reset call, a store setter with `skipUrlUpdate: true`, `router.push`, then
// a post-push notify — those are private per-row closures we can't call
// directly, but the synthetic popstate reaches an equivalent code path via
// Next's App Router's own (undocumented) popstate listener, using only
// public browser APIs. That's a deliberate, evidence-backed tradeoff, not an
// oversight — worth an occasional smoke test in case Axiom's Next.js version
// changes.
//
// The isolated side has no way to know whether the push succeeded, so this
// side always falls back to a hard navigation when the router isn't ready —
// the click does something either way.
window.addEventListener('psc:navigate', (e: Event) => {
  const path = (e as CustomEvent<{ path?: string }>).detail?.path
  // ogStrip.ts already validates/escapes this, but psc:navigate is a plain
  // window CustomEvent any page script can dispatch — the isolated side may
  // be compromised, so this bridge must not trust its input either. Reject
  // anything that isn't a same-origin relative path (must start with a
  // single '/', not protocol-relative '//') before it can reach pushState
  // or location.href as an open-redirect / javascript: sink.
  if (!path || !path.startsWith('/') || path.startsWith('//')) return
  try {
    // `window.next` is a cheap "is this really the Axiom SPA" signal: the
    // pushState+popstate trick only works if Next's App Router has already
    // wired up its own popstate listener, which implies `window.next`
    // exists. Without it we'd silently change the URL and never repaint —
    // exactly the bug this file fixes — so go straight to a hard reload.
    if ((window as any).next) {
      history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } else {
      window.location.href = path
    }
  } catch {
    window.location.href = path
  }
})
