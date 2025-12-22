export type ClusterMember = {
    cluster_id: string;
    wallet_address: string;
    role: string;
    confidence_score: number | null;
    joined_at: string | null; // ISO string
};

export type ClusterWithMembers = {
    cluster_id: string;
    cluster_name: string | null;
    members: ClusterMember[];
};

export interface ClustersByWalletsError {
    error: string
    details?: string
}

export interface ClusterByWalletsAPIResponse {
    clusters: ClusterWithMembers[]
    count: number;
}