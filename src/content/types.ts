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

export interface IngestResponse {
  success: boolean;
  wallet_address: string;
  existed: boolean;
  cluster_id?: string;
  cluster_name?: string;
  error?: string;
}

export interface SimilarTokenMatch {
  ticker: boolean;
  name: boolean;
  image: boolean;
}

export interface SimilarToken {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  liquidity: {
    usd: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
  };
  match: SimilarTokenMatch;
  matchScore: number; // 0-3 based on how many fields match
  axiomLink: string;
}

export interface SimilarTokensResponse {
  tokens: SimilarToken[];
  searchedToken: {
    name: string;
    symbol: string;
    imageUrl?: string;
  };
}
