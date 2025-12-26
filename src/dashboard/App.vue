<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClustersByWallets } from '@/composables/scanner-api/get-cluster-by-wallets'
import { useTokenHolders } from '@/composables/scanner-api/get-token-holders'
import type { ClusterWithMembers } from '@/composables/scanner-api/types'

// Replace with your actual mint address source (props, route, input, etc.)
const mintAddress = ref('7SBwb9VgF1bZQqBXpDyTNpuwPFdmSi7KFJMfFB6FKP9M') // Example

// 1. Fetch top token holders (now returns accountAddress + amounts)
const {
  holders,
  isFetching: holdersFetching,
  error: holdersError,
  execute: executeHolders,
} = useTokenHolders(mintAddress, {
  url: 'http://127.0.0.1:54321/functions/v1/scanner-api/get-token-top-holders', // your new endpoint
  immediate: true,
})

// Derive the list of relevant token accounts (these are the "wallets" for cluster lookup)
const tokenAccounts = computed<string[]>(() => holders.value.map(h => h.accountAddress))

// Map token account → human readable amount for sorting and display
const accountToAmount = computed<Map<string, number>>(() =>
  new Map(holders.value.map(h => [h.accountAddress, h.humanReadableAmount]))
)

// 2. Fetch clusters using the token accounts
const {
  clusters,
  isFetching: clustersFetching,
  error: clustersRawError,
  execute: executeClusters,
} = useClustersByWallets(tokenAccounts, {
  url: 'http://127.0.0.1:54321/functions/v1/scanner-api/get-cluster-by-wallets',
  immediate: false,
})

// Trigger cluster fetch only when we have token accounts
watch(
  tokenAccounts,
  (newAccounts) => {
    if (newAccounts.length > 0) {
      executeClusters()
    }
  },
  { deep: true }
)

// Combined loading and safe error handling
const isFetching = computed(() => holdersFetching.value || clustersFetching.value)

const error = computed(() => {
  if (holdersError.value) return holdersError.value

  const clustersErr = clustersRawError.value
  if (clustersErr) {
    // Ignore normal AbortError from refetching
    if (clustersErr instanceof DOMException && clustersErr.name === 'AbortError') {
      return null
    }
    return clustersErr
  }

  return null
})

// Manual refresh: holders first → clusters auto-follow
const refresh = async () => {
  await executeHolders()
  // clusters will trigger via watch
}

// Filter and sort clusters: only show clusters containing our top token accounts
// Members sorted by balance descending
const filteredClusters = computed<ClusterWithMembers[]>(() => {
  const accountSet = new Set(tokenAccounts.value)

  return clusters.value
    .map(cluster => {
      let matchingMembers = cluster.members.filter(member =>
        accountSet.has(member.wallet_address)
      )

      if (matchingMembers.length === 0) return null

      // Sort by humanReadableAmount (highest first)
      matchingMembers = matchingMembers.sort((a, b) => {
        const amountA = accountToAmount.value.get(a.wallet_address) ?? 0
        const amountB = accountToAmount.value.get(b.wallet_address) ?? 0
        return amountB - amountA
      })

      return { ...cluster, members: matchingMembers }
    })
    .filter((cluster): cluster is ClusterWithMembers => cluster !== null)
})

const filteredCount = computed(() => filteredClusters.value.length)

// Draggable popup logic (unchanged)
const isExpanded = ref(false)
const position = ref({ x: 100, y: 100 })
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })
const startClient = ref({ x: 0, y: 0 })

function startDrag(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragging.value = true
  startClient.value.x = e.clientX
  startClient.value.y = e.clientY
  offset.value.x = e.clientX - position.value.x
  offset.value.y = e.clientY - position.value.y
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', stopDrag)
}

function drag(e: MouseEvent) {
  if (!dragging.value) return
  position.value.x = e.clientX - offset.value.x
  position.value.y = e.clientY - offset.value.y
}

function stopDrag(e: MouseEvent) {
  dragging.value = false
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)

  const dx = Math.abs(e.clientX - startClient.value.x)
  const dy = Math.abs(e.clientY - startClient.value.y)
  if (dx < 5 && dy < 5) {
    toggleExpand()
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="popup absolute bg-slate-950 shadow-lg rounded-lg p-2 overflow-hidden cursor-default"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }">
    <div class="drag-handle w-12 h-12 rounded-full flex items-center justify-center text-white cursor-move"
      @mousedown="startDrag">
      <img src="/src/assets/LOGO_CIRCLE_TRANSPARENT_500x500.svg" alt="Logo" class="w-12 h-12 rounded-full" />
    </div>

    <div v-if="isExpanded" class="content p-4 min-w-[500px] text-white">
      <h2 class="text-lg font-bold mb-4">Top Token Accounts → Clusters</h2>

      <div v-if="isFetching" class="text-slate-300">Loading data...</div>
      <div v-else-if="error" class="text-red-400">
        Error: {{ error || 'Failed to fetch data' }}
      </div>
      <div v-else-if="filteredClusters.length === 0" class="text-slate-400">
        No clusters found containing these top token accounts.
      </div>
      <div v-else>
        <p class="mb-4">
          <strong>Found:</strong> {{ filteredCount }} cluster(s) from top {{ holders.length }} token accounts
        </p>

        <div class="clusters-registry space-y-6">
          <div v-for="cluster in filteredClusters" :key="cluster.cluster_id" class="cluster-group">
            <div class="text-xs text-slate-400 mb-1">
              {{ cluster.cluster_name || 'Unnamed Cluster' }} (ID: {{ cluster.cluster_id }})
            </div>

            <div class="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
              <div v-for="member in cluster.members" :key="member.wallet_address"
                class="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span class="text-xs font-mono break-all max-w-[300px]">
                  {{ member.wallet_address }}
                </span>
                <span class="text-sm font-semibold ml-4 whitespace-nowrap">
                  {{ (accountToAmount.get(member.wallet_address) ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 6
                  }) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button @click="refresh" :disabled="isFetching"
        class="mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition">
        {{ isFetching ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.popup {
  transition: none;
  user-select: none;
}
</style>