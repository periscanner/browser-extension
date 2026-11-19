import { describe, expect, it } from 'vitest'
import { imageCandidates, pumpImageUrl } from '../src/content/utils/imageSources'

const MINT = 'J9k8HMiDbg7tSNyYtgurDL59oMXX7X8b2GHPhjeapump'
const CID1 = 'bafkreidmkaf5tbbogmjgfqivh22r6vhzpf4o4qyraqlv4ybivqpzdawndu'
const CID0 = 'QmTd2fDszGArjXWmehtmqhHmmZqaEjPsbrADU72jELp7T9'
const PUMP = `https://images.pump.fun/coin-image/${MINT}?variant=64x64`

describe('imageCandidates', () => {
  it('skips the dead ipfs.io gateway: pump CDN first, then live IPFS gateways (the real "W" rows)', () => {
    expect(imageCandidates(`https://ipfs.io/ipfs/${CID1}`, MINT)).toEqual([
      PUMP,
      `https://pump.mypinata.cloud/ipfs/${CID1}`,
      `https://gateway.pinata.cloud/ipfs/${CID1}`,
    ])
  })

  it.each([
    ['dweb.link', `https://dweb.link/ipfs/${CID0}`],
    ['w3s.link', `https://w3s.link/ipfs/${CID0}`],
    ['nftstorage.link', `https://nftstorage.link/ipfs/${CID0}`],
    ['ipfs:// scheme', `ipfs://${CID0}`],
    ['subdomain gateway', `https://${CID1}.ipfs.dweb.link/`],
  ])('rewrites %s', (_n, url) => {
    const out = imageCandidates(url, MINT)
    expect(out[0]).toBe(PUMP)
    expect(out.some((u) => u.startsWith('https://pump.mypinata.cloud/ipfs/'))).toBe(true)
    expect(out.some((u) => /ipfs\.io|dweb|w3s|nftstorage/.test(u))).toBe(false)
  })

  it('keeps the sub-path of a gateway URL', () => {
    expect(imageCandidates(`https://ipfs.io/ipfs/${CID0}/logo.png`, undefined)).toEqual([
      `https://pump.mypinata.cloud/ipfs/${CID0}/logo.png`,
      `https://gateway.pinata.cloud/ipfs/${CID0}/logo.png`,
    ])
  })

  it('keeps a healthy CDN url first and still adds the fallbacks', () => {
    const cdn = 'https://axiomtrading-v2.axiom-cdn.io/AKDjR5f6sisQkJyhYdGHfqPtdXu9upZc4GZuH9GJpump.webp'
    const out = imageCandidates(cdn, MINT)
    expect(out).toEqual([cdn, PUMP])
  })

  it('keeps a non-public IPFS host (e.g. a Pinata dedicated gateway) first, with CID fallbacks', () => {
    const out = imageCandidates(`https://pump.mypinata.cloud/ipfs/${CID1}`, undefined)
    expect(out[0]).toBe(`https://pump.mypinata.cloud/ipfs/${CID1}`)
    expect(out).toEqual([
      `https://pump.mypinata.cloud/ipfs/${CID1}`,
      `https://gateway.pinata.cloud/ipfs/${CID1}`,
    ])
  })

  it('no API url: pump CDN for a pump mint, nothing otherwise (glyph)', () => {
    expect(imageCandidates('', MINT)).toEqual([PUMP])
    expect(imageCandidates(undefined, '7ge9CUEtZ4gQtMf9eiPf5Mk9Gv8j8wCds3m49tUVcHa1')).toEqual([])
  })

  it('upgrades http to https', () => {
    expect(imageCandidates('http://j7m.io/images/abc', undefined)).toEqual(['https://j7m.io/images/abc'])
  })

  it('rejects unsafe and malformed urls, and never forwards attacker text into a fallback host', () => {
    expect(imageCandidates('javascript:alert(1)', undefined)).toEqual([])
    expect(imageCandidates('data:image/svg+xml;base64,PHN2Zz4=', undefined)).toEqual([])
    expect(imageCandidates('not a url', undefined)).toEqual([])
    // invalid CID / traversal in a gateway path: no IPFS fallback is derived
    expect(imageCandidates('https://ipfs.io/ipfs/../../etc/passwd', undefined)).toEqual([])
    expect(imageCandidates(`https://ipfs.io/ipfs/${CID0}/../../x`, undefined)).toEqual([])
    expect(imageCandidates(`https://ipfs.io/ipfs/${CID0}/a"onerror="x`, undefined)).toEqual([])
  })

  it('pumpImageUrl only accepts base58 pump mints', () => {
    expect(pumpImageUrl(MINT)).toBe(PUMP)
    expect(pumpImageUrl('../evilpump')).toBeNull()
    expect(pumpImageUrl('So11111111111111111111111111111111111111112')).toBeNull()
    expect(pumpImageUrl(undefined)).toBeNull()
  })
})
