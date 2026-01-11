import { ref, readonly } from 'vue';
import type { ClusterByWalletsAPIResponse, ClusterWithMembers } from '../types';

export function useClustersByWallets() {
  const clusters = ref<ClusterWithMembers[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchClustersByWallets = async (wallets: string[]) => {
    if (!wallets?.length) return;

    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('https://fibjnghzdogyhjzubokf.supabase.co/functions/v1/scanner-api/get-cluster-by-wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data: ClusterByWalletsAPIResponse = await response.json();
      clusters.value = data.clusters || [];
      return data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch clusters';
      console.error('Cluster Fetch Error:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    clusters: readonly(clusters),
    loading: readonly(loading), // Simplified readonly
    error,
    fetchClustersByWallets,
    reset: () => {
      clusters.value = [];
      error.value = null;
      loading.value = false;
    }
  };
}