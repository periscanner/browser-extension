export function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`
  }
  return num.toFixed(decimals)
}

export function calculatePercentage(amount: number, totalSupply: number): string {
  const percentage = (amount / totalSupply) * 100
  return `${percentage.toFixed(2)}%`
}

// Compact USD market cap for dense UI (OG strip, etc.) — "$1.2M" / "$45K" / "$980".
// Distinct from formatNumber: always $-prefixed and picks decimals per tier
// rather than taking a caller-supplied fixed decimal count.
export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value)}`
}
