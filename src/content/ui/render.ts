import { formatNumber, calculatePercentage } from '../utils/format'
import { ClusterMember } from '../types'

export function renderResults(
  ui: any,
  clusters: any[],
  amountMap: Map<string, number>,
  totalSupply: number
) {
  if (clusters.length === 0) {
    ui.content.innerHTML = `<div class="cs-empty">No shared clusters found among top holders.</div>`
    return
  }

  const html = clusters.map((c: any) => `
    <div class="cs-cluster">
      <div class="cs-cluster-header">
        <a href="https://periscanner.xyz/cluster/${c.cluster_id}" target="_blank" class="cs-cluster-name-link">
          <span class="cs-cluster-name">${c.cluster_name || 'Unnamed Cluster'}</span>
        </a>
        <div class="cs-cluster-total">
          <span class="cs-cluster-amount">${formatNumber(c.totalAmount)}</span>
          <span class="cs-cluster-percentage">${calculatePercentage(c.totalAmount, totalSupply)}</span>
        </div>
      </div>
      <div>
        ${c.members.map((m: ClusterMember) => {
    const amount = amountMap.get(m.wallet_address) || 0
    return `
            <div class="cs-member">
              <div class="cs-member-left">
                <span class="cs-member-addr" data-full-address="${m.wallet_address}" title="Click to copy">${m.wallet_address.slice(0, 4)}...${m.wallet_address.slice(-4)}</span>
                <span class="cs-member-role">${m.role}</span>
              </div>
              <div class="cs-member-right">
                <span class="cs-member-amount">${formatNumber(amount)}</span>
                <span class="cs-member-percentage">${calculatePercentage(amount, totalSupply)}</span>
              </div>
            </div>
          `
  }).join('')}
      </div>
    </div>
  `).join('')

  ui.content.innerHTML = html

  // Add click listeners for wallet addresses
  const addrs = ui.content.querySelectorAll('.cs-member-addr')
  addrs.forEach((el: HTMLElement) => {
    el.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      const target = e.currentTarget as HTMLElement
      const address = target.getAttribute('data-full-address')
      if (address) {
        try {
          await navigator.clipboard.writeText(address)
          showToast('Wallet copied')
        } catch (err) {
          console.error('Failed to copy', err)
        }
      }
    })
  })
}

function showToast(message: string) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.cs-toast')
  if (existingToast) {
    existingToast.remove()
  }

  const toast = document.createElement('div')
  toast.className = 'cs-toast'
  toast.textContent = message
  document.body.appendChild(toast)

  // Force reflow
  void toast.offsetWidth

  toast.classList.add('visible')

  setTimeout(() => {
    toast.classList.remove('visible')
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove()
      }
    }, 300)
  }, 3000)
}