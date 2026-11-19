// Ordered image candidates for one OG-strip avatar.
//
// Why this exists: scanner-api hands back whatever `info.imageUrl` DexScreener
// (or the Helius DAS fallback) knows, and for pump.fun tokens that is mostly an
// `https://ipfs.io/ipfs/<cid>` URL. The public IPFS gateways (ipfs.io, dweb.link,
// w3s.link, nftstorage.link) are in a sunset brownout and answer HTTP 429 to
// image hot-linking, so those rows fell through to the letter glyph. Some
// tokens also have no image at all in DexScreener (e.g. pairs quoted against a
// non-SOL token). So each row gets a chain: the API url (unless it is a dead
// public gateway), then pump.fun's own mint-keyed image CDN, then IPFS CIDs on
// gateways that still serve. The letter glyph stays the last resort.
//
// Threat model is unchanged: the API url is attacker-controlled. Every
// candidate is a validated http(s) URL; the fallback hosts are hardcoded and
// only a strictly validated CID/path or base58 mint is ever appended to them.
import { safeHttpUrl } from './escape'

const PUMP_IMAGE_BASE = 'https://images.pump.fun/coin-image/'
// Gateways that still serve hot-linked images; tried in this order.
const IPFS_FALLBACK_GATEWAYS = [
  'https://pump.mypinata.cloud/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
]
// Public gateways that rate-limit/blocked image hot-linking (429/403): never used as-is.
const DEAD_GATEWAY_HOSTS = new Set([
  'ipfs.io', 'www.ipfs.io', 'gateway.ipfs.io', 'dweb.link', 'w3s.link',
  'nftstorage.link', 'cloudflare-ipfs.com', 'cf-ipfs.com', 'ipfs.infura.io',
])
const DEAD_GATEWAY_SUBDOMAIN_SUFFIXES = ['.ipfs.dweb.link', '.ipfs.w3s.link', '.ipfs.nftstorage.link', '.ipfs.cf-ipfs.com']

const BASE58_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
// CIDv0 (Qm…, base58) and CIDv1 (base32, usually bafy…/bafk…).
const CID = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,120})$/
const PATH_SEGMENT = /^[A-Za-z0-9._~-]{1,100}$/

interface IpfsRef { cid: string; path: string }

function cleanPath(rest: string[]): string | null {
  if (rest.length > 3 || !rest.every((s) => PATH_SEGMENT.test(s) && s !== '..')) return null
  return rest.length ? '/' + rest.join('/') : ''
}

// Pulls the CID (+ optional sub-path) out of ipfs://<cid>/…, a path gateway
// (https://<host>/ipfs/<cid>/…) or a subdomain gateway (https://<cid>.ipfs.<host>/…).
function parseIpfs(raw: string): IpfsRef | null {
  let segs: string[] | null = null
  const scheme = /^ipfs:\/\/(?:ipfs\/)?(.+)$/i.exec(raw.trim())
  if (scheme) {
    segs = scheme[1].split(/[?#]/)[0].split('/').filter(Boolean)
  } else {
    let u: URL
    try { u = new URL(raw) } catch { return null }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'ipfs' && parts.length >= 2) {
      segs = parts.slice(1)
    } else {
      const sub = /^([^.]+)\.ipfs\./.exec(u.hostname)
      if (sub) segs = [sub[1], ...parts]
    }
  }
  if (!segs || segs.length === 0 || !CID.test(segs[0])) return null
  const path = cleanPath(segs.slice(1))
  return path === null ? null : { cid: segs[0], path }
}

function isDeadGateway(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return DEAD_GATEWAY_HOSTS.has(host) || DEAD_GATEWAY_SUBDOMAIN_SUFFIXES.some((s) => host.endsWith(s))
  } catch {
    return true
  }
}

/** The mint a mint-keyed image URL belongs to (Axiom's CDN serves
 *  `<host>/<mint>.webp`, pump.fun `coin-image/<mint>`), or null for any other URL. */
function mintInImageUrl(raw: string): string | null {
  try {
    const last = new URL(raw).pathname.split('/').filter(Boolean).pop() ?? ''
    const stem = last.replace(/\.[A-Za-z0-9]{1,5}$/, '')
    return BASE58_MINT.test(stem) ? stem : null
  } catch {
    return null
  }
}

/** pump.fun's mint-keyed image CDN. Only for `…pump` mints: for any other mint
 *  it answers 200 with a generic placeholder, which would pass for a real image. */
export function pumpImageUrl(mint: string | undefined): string | null {
  return mint && BASE58_MINT.test(mint) && mint.endsWith('pump') ? `${PUMP_IMAGE_BASE}${mint}?variant=64x64` : null
}

/** Ordered, de-duplicated, validated http(s) image URLs to try before the glyph. */
export function imageCandidates(rawUrl: string | undefined, mint: string | undefined): string[] {
  const out: string[] = []
  const add = (u: string | null | undefined) => {
    const safe = safeHttpUrl(u ?? undefined)
    if (!safe) return
    // Axiom is https: an http image would be blocked as mixed content.
    const https = safe.replace(/^http:/i, 'https:')
    if (!out.includes(https)) out.push(https)
  }

  const ipfs = rawUrl ? parseIpfs(rawUrl) : null
  const direct = rawUrl && !/^ipfs:/i.test(rawUrl.trim()) ? safeHttpUrl(rawUrl) : null
  // DexScreener sometimes attaches another token's image to a pair (a same-name
  // relaunch): a URL keyed by a *different* mint than this row's is never ours.
  const foreign = direct && mint ? mintInImageUrl(direct) : null
  if (direct && !isDeadGateway(direct) && (!foreign || foreign === mint)) add(direct)
  add(pumpImageUrl(mint))
  if (ipfs) for (const gw of IPFS_FALLBACK_GATEWAYS) add(`${gw}${ipfs.cid}${ipfs.path}`)
  return out
}
