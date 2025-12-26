<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClustersByWallets } from '@/composables/scanner-api/get-cluster-by-wallets'
import type {
  ClusterWithMembers,
} from '@/composables/scanner-api/types'

// Example wallet addresses (could come from user input, route params, etc.)
const wallets = ref<string[]>(["7NAd2EpYGGeFofpyvgehSXhH5vg6Ry6VRMW2Y6jiqCu1", "B2t9mZumoK81bLPBhDtQYGmrprs4XzijXwFrLxv9DZxM", "GMKNH8xEAfpMzk4oChsv3iLv6mAw8ksZQd6tbvLMuvLr"])

const { clusters, isFetching, error, execute } = useClustersByWallets(wallets, {
  url: 'http://127.0.0.1:54321/functions/v1/scanner-api/get-cluster-by-wallets',
  immediate: true, // Auto-fetch when wallets change
})

// Manual refresh example
const refresh = () => execute()

// Compute a set for fast lookup
const walletSet = computed(() => new Set(wallets.value))

// Filtered clusters: only show clusters with matching members, and only those members
const filteredClusters = computed<ClusterWithMembers[]>(() => {
  return clusters.value
    .map(cluster => {
      const matchingMembers = cluster.members.filter(member => walletSet.value.has(member.wallet_address))
      if (matchingMembers.length > 0) {
        return { ...cluster, members: matchingMembers }
      }
      return null
    })
    .filter((cluster): cluster is ClusterWithMembers => cluster !== null)
})

const filteredCount = computed(() => filteredClusters.value.length)

// Draggable popup state
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

  // Check if it was a click (not a drag)
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
      <img src="/src/assets/LOGO_CIRCLE_TRANSPARENT_500x500.svg" alt="Maximize" class="w-12 h-12 rounded-full" />
    </div>

    <div v-if="isExpanded" class="content p-4 min-w-[400px]">
      <div v-if="isFetching" class="text-white">Loading clusters...</div>
      <div v-else-if="error" class="text-white">Error: {{ error || 'Failed to fetch' }}</div>
      <div v-else-if="filteredClusters.length > 0">
        <p class="text-white mb-4"><strong>Found:</strong> {{ filteredCount }} cluster(s)</p>
        <div class="clusters-registry">
          <div v-for="cluster in filteredClusters" :key="cluster.cluster_id" class="mb-2">
            <span class="text-xs text-slate-400">{{ cluster.cluster_name }}</span>
            <div class="px-2 py-3 mt-1 rounded-lg border border-slate-700">
              <div v-for="member in cluster.members" :key="member.wallet_address"
                class="cluster-member flex items-center justify-between gap-2 text-slate-200">
                <span class="text-xs">{{ member.wallet_address }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button @click="refresh" :disabled="isFetching"
        class="mt-4 bg-blue-500 text-white px-4 py-2 rounded text-white">Refresh</button>
    </div>
  </div>
</template>