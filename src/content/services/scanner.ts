const B58 = '[1-9A-HJ-NP-Za-km-z]{32,44}'

/**
 * Read the real token MINT from the page DOM. On axiom.trade the URL path holds
 * an AMM pool id (e.g. /meme/<pool>), NOT the mint — so when DexScreener can't
 * resolve the pool (brand-new tokens), we read the mint from the embedded
 * holder-map iframe (`?...tokenAddress=<mint>`) or a launchpad/explorer link.
 * Returns null if no reliable mint is found in the DOM.
 */
export function extractMintFromDom(): string | null {
  // 1. Embedded holder-map iframe (faster100x etc.) carries the mint explicitly.
  const iframe = document.querySelector('iframe[src*="tokenAddress="]') as HTMLIFrameElement | null
  const iMatch = iframe?.src.match(new RegExp('tokenAddress=(' + B58 + ')'))
  if (iMatch) {
    console.log('[Cluster Scanner] Mint from holder-map iframe:', iMatch[1])
    return iMatch[1]
  }

  // 2. Launchpad / token-explorer links point at the mint (pair links don't).
  const linkRe = new RegExp('(?:pump\\.fun/coin/|solscan\\.io/token/|birdeye\\.so/token/)(' + B58 + ')')
  for (const a of Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]) {
    const m = a.href.match(linkRe)
    if (m) {
      console.log('[Cluster Scanner] Mint from explorer link:', m[1])
      return m[1]
    }
  }

  return null
}

export function extractTokenFromUrl(): string | null {
  const path = window.location.pathname
  const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/
  const pathMatch = path.match(addressRegex)

  if (pathMatch) {
    console.log('[Cluster Scanner] Found address in path:', pathMatch[0])
    return pathMatch[0]
  }

  const iframe = document.querySelector('iframe[src*="tokenAddress="]')
  if (iframe) {
    const src = iframe.getAttribute('src')
    if (src) {
      const match = src.match(/tokenAddress=([^&]+)/)
      if (match) {
        console.log('[Cluster Scanner] Found token in iframe:', match[1])
        return match[1]
      }
    }
  }

  return null
}