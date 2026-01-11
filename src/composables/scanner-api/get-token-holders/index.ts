import { ref, readonly } from 'vue';
import type { TokenHoldersAPIResponse, TokenHolder } from './types';

export function useTokenHolders() {
  const holders = ref<TokenHolder[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchLargestHolders = async (mintAddress: string) => {
    if (!mintAddress) {
      error.value = 'Mint address is required';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('https://fibjnghzdogyhjzubokf.supabase.co/functions/v1/scanner-api/get-token-top-holders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAddress }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: TokenHoldersAPIResponse = await response.json();
      holders.value = data.holders || [];
      return data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch holders';
      console.error('Holders Fetch Error:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    holders: readonly(holders),
    loading: readonly(loading),
    error,
    fetchLargestHolders,
    reset: () => {
      holders.value = [];
      error.value = null;
      loading.value = false;
    }
  };
}