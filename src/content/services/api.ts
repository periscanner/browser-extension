import { API_URL } from '../config'
import { ScanResult, ClusterResponse, IngestResponse, SimilarTokensResponse } from '../types'

export async function fetchScanResults(urlTokenAddress: string): Promise<ScanResult> {
  const response = await fetch(`${API_URL}/extension/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urlTokenAddress }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to scan pair')
  }

  return await response.json()
}

export async function fetchClustersByWallets(wallets: string[]): Promise<ClusterResponse> {
  const response = await fetch(`${API_URL}/cluster/by-wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets })
  })

  if (!response.ok) throw new Error('Failed to fetch clusters')
  return await response.json()
}

export async function ingestWalletsBulk(wallets: string[]): Promise<IngestResponse[]> {
  const response = await fetch(`${API_URL}/wallet/ingest-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets })
  })

  if (!response.ok) throw new Error('Failed to ingest wallets')
  return await response.json()
}

export async function fetchSimilarTokens(name: string, symbol: string, imageUrl?: string): Promise<SimilarTokensResponse> {
  const response = await fetch(`${API_URL}/extension/similar-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, symbol, imageUrl })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to fetch similar tokens')
  }

  return await response.json()
}