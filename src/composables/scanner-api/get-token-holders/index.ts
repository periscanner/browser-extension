// @/composables/scanner-api/get-token-holders.ts

import { computed, watch, type Ref } from 'vue'
import { useFetch } from '@vueuse/core'

import type {
    TokenHoldersAPIResponse,
    TokenHolder,
    TokenHoldersError,
} from './types'

export interface UseTokenHoldersOptions {
    /**
     * Full API endpoint URL for the POST request
     * e.g., 'http://127.0.0.1:54321/functions/v1/scanner-api/get-token-holders'
     */
    url: string
    /**
     * Auto-fetch when the mint address changes
     * @default true
     */
    immediate?: boolean
}

/**
 * Reusable composable to fetch token holders for a given mint address (POST).
 *
 * Returns typed reactive state with holders, count, stats, loading, error, etc.
 */
export function useTokenHolders(
    mintAddressRef: Ref<string | null | undefined>,
    options: UseTokenHoldersOptions
) {
    const { url, immediate = true } = options

    // Only send request if we have a valid mint address
    const payload = computed(() => {
        const mint = mintAddressRef.value?.trim()
        return mint ? { mintAddress: mint } : null
    })

    const {
        data,
        error,
        isFetching,
        execute,
        abort,
    } = useFetch<TokenHoldersAPIResponse>(
        url,
        { immediate: false } // We control execution manually
    )
        .post(payload)
        .json()

    // Auto-refetch when payload changes (i.e., when mint address changes)
    if (immediate) {
        watch(
            payload,
            (newPayload) => {
                if (newPayload) {
                    execute()
                }
            },
            { deep: true }
        )
    }

    return {
        /** List of token holders */
        holders: computed<TokenHolder[]>(() => data.value?.holders ?? []),

        /** Total number of holders returned */
        count: computed<number>(() => data.value?.count ?? 0),

        /** Additional stats from the API */
        stats: computed(() => data.value?.stats ?? null),

        /** Whether the request is currently in flight */
        isFetching: computed<boolean>(() => isFetching.value),

        /** Error object if the request failed */
        error: computed<TokenHoldersError | Error | null>(() => error.value),

        /** Manual trigger for refetching (useful for refresh buttons) */
        execute,

        /** Abort ongoing request (e.g., on component unmount) */
        abort,
    }
}