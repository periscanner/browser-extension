type MemberRole = "hub" | "primary" | "core" | "auxiliary" | "external"

export interface ClusterMember {
  cluster_id: string
  wallet_address: string
  role: MemberRole
  confidence_score: number
  joined_at: string
}

export interface ClusterWithMembers {
  cluster_id: string
  cluster_name: string | null
  members: ClusterMember[]
}

export interface TokenHolder {
  owner: string
  amount: string
  humanReadableAmount: number
  tokenAccountAddress: string
}

export interface ScanResult {
  resolvedMint: string
  holders: TokenHolder[]
  count: number
  totalUniqueHolders: number
  stats: {
    totalHolders: number
    top20Count: number
    totalInTop20: number
    percentageOfSupply: number
    totalSupply: number
  }
  metadata: {
    decimals: number
    supply: string
  }
}

export interface ClusterResponse {
  clusters: ClusterWithMembers[]
  count: number
}