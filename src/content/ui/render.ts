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
        <span class="cs-cluster-name">${c.cluster_name || 'Unnamed Cluster'}</span>
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
                <span class="cs-member-addr">${m.wallet_address.slice(0, 4)}...${m.wallet_address.slice(-4)}</span>
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
}