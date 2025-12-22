import { ClusterWithMembers } from "@/composables/scanner-api/types";
import { ClusterMember } from "@/lib/supabase.types";

export interface ClassifiedCluster {
    primary: ClusterMember[]
    core: ClusterMember[]
    auxiliary: ClusterMember[]
}

export interface ClusterWithClassifiedMembers extends Omit<ClusterWithMembers, 'members'> {
    members: ClassifiedCluster
}

/**
 * Classifies members of a single cluster into primary, core, and auxiliary
 * based on confidence_score thresholds.
 */
export function classifyClusterMembers(cluster: ClusterWithMembers): ClusterWithClassifiedMembers {
    const primary: ClusterMember[] = []
    const core: ClusterMember[] = []
    const auxiliary: ClusterMember[] = []

    for (const member of cluster.members) {
        if (!member.confidence_score) break;

        if (member.confidence_score >= 0.75) {
            primary.push(member)
        } else if (member.confidence_score >= 0.5) {
            core.push(member)
        } else {
            auxiliary.push(member)
        }
    }

    return {
        ...cluster,
        members: {
            primary,
            core,
            auxiliary,
        },
    }
}

/**
 * Classifies members for an array of clusters.
 * Returns a new array with classified members (original data unchanged).
 */
export function classifyClusters(clusters: ClusterWithMembers[]): ClusterWithClassifiedMembers[] {
    return clusters.map(classifyClusterMembers)
}

/**
 * Extracts all wallet addresses from clusters (supports both raw and classified clusters)
 * and returns a deduplicated array of unique wallet addresses.
 *
 * @param clusters - Array of clusters (can be ClusterWithMembers[] or ClusterWithClassifiedMembers[])
 * @returns string[] - Unique wallet addresses (case-sensitive)
 */
export function extractUniqueWalletAddresses(
    clusters: ClusterWithMembers[] | ClusterWithClassifiedMembers[]
): string[] {
    const walletSet = new Set<string>()

    for (const cluster of clusters) {
        let members: ClusterMember[]

        // Handle both raw and classified cluster shapes
        if ('members' in cluster && Array.isArray((cluster as any).members)) {
            // Raw ClusterWithMembers
            members = (cluster as ClusterWithMembers).members
        } else {
            // Classified: members is an object { primary, core, auxiliary }
            const classified = (cluster as ClusterWithClassifiedMembers).members
            members = [...classified.primary, ...classified.core, ...classified.auxiliary]
        }

        for (const member of members) {
            if (member.wallet_address) {
                walletSet.add(member.wallet_address)
            }
        }
    }

    return Array.from(walletSet)
}

/**
 * Extracts unique wallets that have at least one membership with confidence_score
 * greater than or equal to the specified minimum threshold.
 *
 * @param clusters - Array of clusters (raw or classified)
 * @param minConfidence - Minimum confidence_score to include a wallet (default: 0.5)
 * @returns Array of wallets with their highest confidence score and all roles across clusters
 */
export interface WalletWithMaxConfidence {
    wallet_address: string
    max_confidence_score: number | null
    roles: string[] // All roles this wallet has in qualifying clusters/memberships
}

export function getClustersMembersByConfidenceScore(
    clusters: ClusterWithMembers[] | ClusterWithClassifiedMembers[],
    minConfidence: number = 0.5
): WalletWithMaxConfidence[] {
    const walletMap = new Map<string, WalletWithMaxConfidence>()

    for (const cluster of clusters) {
        const members: ClusterMember[] =
            'members' in cluster && Array.isArray((cluster as any).members)
                ? (cluster as ClusterWithMembers).members
                : [
                    ...(cluster as ClusterWithClassifiedMembers).members.primary,
                    ...(cluster as ClusterWithClassifiedMembers).members.core,
                    ...(cluster as ClusterWithClassifiedMembers).members.auxiliary,
                ]

        for (const member of members) {
            const addr = member.wallet_address
            if (!addr) continue

            const score = member.confidence_score ?? 0

            // Skip if this membership doesn't meet the minimum confidence
            if (score < minConfidence) continue

            const existing = walletMap.get(addr)

            if (existing) {
                // Update max score if this one is higher
                if (score > (existing.max_confidence_score ?? 0)) {
                    existing.max_confidence_score = score
                }
                // Add role if not already present
                if (!existing.roles.includes(member.role)) {
                    existing.roles.push(member.role)
                }
            } else {
                // First time seeing this wallet at or above threshold
                walletMap.set(addr, {
                    wallet_address: addr,
                    max_confidence_score: score,
                    roles: [member.role],
                })
            }
        }
    }

    // Optional: sort by highest confidence descending
    return Array.from(walletMap.values()).sort(
        (a, b) => (b.max_confidence_score ?? 0) - (a.max_confidence_score ?? 0)
    )
}