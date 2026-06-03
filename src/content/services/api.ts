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

// ---- Async ingestion (Cloudflare Queues) ----

export type JobStatusValue = 'queued' | 'processing' | 'completed' | 'failed'

export interface IngestJobTicket {
  jobId: string
  status: JobStatusValue
  total?: number
  statusUrl?: string
}

export interface JobStatus {
  id: string
  status: JobStatusValue
  progress: number
  processed: number
  total: number | null
  result?: IngestResponse[]
  error?: string | null
}

// Enqueue an async ingestion job; returns immediately with a job id.
export async function submitIngestJob(wallets: string[], scanLevel = 'normal'): Promise<IngestJobTicket> {
  const response = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets, scan_level: scanLevel })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to submit ingestion job')
  }
  return await response.json()
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/jobs/${jobId}`)
  if (!response.ok) throw new Error('Failed to fetch job status')
  return await response.json()
}

// Poll a job until it reaches a terminal state, reporting progress (0..1).
export async function pollIngestJob(
  jobId: string,
  onProgress?: (progress: number, processed: number, total: number | null) => void,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<JobStatus> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 15 * 60 * 1000
  const start = Date.now()

  for (;;) {
    const status = await getJobStatus(jobId)
    onProgress?.(status.progress ?? 0, status.processed ?? 0, status.total ?? null)

    if (status.status === 'completed') return status
    if (status.status === 'failed') throw new Error(status.error || 'Ingestion job failed')
    if (Date.now() - start > timeoutMs) throw new Error('Ingestion timed out')

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
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