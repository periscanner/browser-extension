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