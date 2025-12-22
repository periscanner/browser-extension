import { computed, watch, type Ref } from 'vue'
import { useFetch } from '@vueuse/core'

import type {
    ClusterByWalletsAPIResponse,
    ClusterMember,
    ClustersByWalletsError,
    ClusterWithMembers,
} from '@/composables/scanner-api/types'

export interface UseClustersOptions {
    /**
     * Full API endpoint URL for the POST request
     * e.g., 'https://your-domain.com/api/getClustersByWallet'
     */
    url: string
    /**
     * Auto-fetch when the wallets array changes
     * @default true
     */
    immediate?: boolean
}

/**
 * Reusable composable to fetch clusters by wallet addresses using POST.
 *
 * Returns typed reactive state with clusters, count, loading, error, etc.
 */
export function useClustersByWallets(
    walletsRef: Ref<string[]>,
    options: UseClustersOptions
) {
    const { url, immediate = true } = options

    // Reactive POST payload
    const payload = computed(() => ({ wallets: walletsRef.value }))

    const {
        data,
        error,
        isFetching,
        execute,
        abort,
    } = useFetch<ClusterByWalletsAPIResponse>(
        url,
        { immediate: false } // We'll control execution manually via watch
    )
        .post(payload)
        .json()

    // Auto-refetch whenever the wallets array changes (deep watch for mutations)
    if (immediate) {
        watch(payload, () => execute(), { deep: true })
    }

    return {
        clusters: computed<ClusterWithMembers[]>(() => data.value?.clusters ?? []),
        /** Individual members across all clusters (flattened) – useful for some views */
        allMembers: computed<ClusterMember[]>(() =>
            data.value?.clusters.flatMap((c: ClusterWithMembers) => c.members) ?? []
        ),
        count: computed<number>(() => data.value?.count ?? 0),
        isFetching: computed<boolean>(() => isFetching.value),
        error: computed<ClustersByWalletsError | Error | null>(() => error.value),
        execute,
        abort,
    }
}