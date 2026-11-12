// Runs in Axiom's MAIN world (see manifest.config.ts — `world: 'MAIN'`,
// `run_at: 'document_start'`). Content scripts normally execute in an
// isolated world, so this tiny bridge does the actual same-tab navigation on
// behalf of the isolated content script (ui/ogStrip.ts). It listens for a
// `psc:navigate` CustomEvent dispatched on `window` with `detail.path`
// (e.g. "/token/<mint>?chain=sol") and does a hard `location.href` navigation
// (verified live: Axiom has no `window.next`, and /meme/<id> redirects to
// /token/<id>).
window.addEventListener('psc:navigate', (e: Event) => {
  const path = (e as CustomEvent<{ path?: string }>).detail?.path
  // ogStrip.ts already validates/escapes this, but psc:navigate is a plain
  // window CustomEvent any page script can dispatch — the isolated side may
  // be compromised, so this bridge must not trust its input either. Reject
  // anything that isn't a same-origin relative path (must start with a
  // single '/', not protocol-relative '//') before it can reach
  // location.href as an open-redirect / javascript: sink.
  if (!path || !path.startsWith('/') || path.startsWith('//')) return
  window.location.href = path
})
