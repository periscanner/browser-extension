<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClustersByWallets } from '@/composables/scanner-api/get-cluster-by-wallets'

// Example wallet addresses (could come from user input, route params, etc.)
const wallets = ref<string[]>(["7NAd2EpYGGeFofpyvgehSXhH5vg6Ry6VRMW2Y6jiqCu1", "B2t9mZumoK81bLPBhDtQYGmrprs4XzijXwFrLxv9DZxM", "GMKNH8xEAfpMzk4oChsv3iLv6mAw8ksZQd6tbvLMuvLr"])

const { clusters, count, isFetching, error, execute } = useClustersByWallets(wallets, {
  url: 'http://127.0.0.1:54321/functions/v1/scanner-api/get-cluster-by-wallets',
  immediate: true, // Auto-fetch when wallets change
})

// Manual refresh example
const refresh = () => execute()
</script>

<template>
  <div class="cluster-viewer">
    <h2>Clusters for {{ wallets.length }} wallet(s)</h2>

    <div v-if="isFetching">Loading clusters...</div>
    <div v-else-if="error">Error: {{ error || 'Failed to fetch' }}</div>
    <div v-else-if="clusters.length > 0">
      <p><strong>Found:</strong> {{ count }} cluster(s)</p>

      <div class="cluster-viewer">
        <div v-if="clusters.length > 0">

          <div class="clusters-registry">
            <h2>Clusters Registry</h2>

            <div v-for="cluster in clusters" :key="cluster.cluster_id" class="cluster-group">
              <div class="cluster-header">
                <strong>ID: {{ cluster.cluster_id }}</strong> |
                <span>Name: {{ cluster.cluster_name }}</span>
              </div>

              <div class="wallet-list">
                <div v-for="member in cluster.members" :key="member.wallet_address" class="wallet-item">
                  <span class="address">{{ member.wallet_address }}</span>
                  <span class="score">Score: {{ member.confidence_score }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <button @click="refresh" :disabled="isFetching">Refresh</button>
  </div>
</template>