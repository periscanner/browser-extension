// Stock-paired coin whose creator fee goes to the dev wallet (isDevFeeStock).
// Shared by the OG strip rows and the Axiom header badge. Same strict `=== true` gate and hardcoded markup as the other row icons; the
// glyph is lucide's chef-hat. Tooltip is static: the exact fee rate is not
// sent by the API.
export const DEV_FEE_CHEF =
  '<span class="psc-og-dev-fee" title="Dev earns a creator fee on this stock-paired coin">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg></span>'
export function devFeeHtml(isDevFeeStock: boolean | undefined): string {
  return isDevFeeStock === true ? DEV_FEE_CHEF : ''
}

