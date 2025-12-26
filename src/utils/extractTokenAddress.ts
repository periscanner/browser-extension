export default function extractTokenAddress(html: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const link = doc.querySelector('a[href*="pump.fun/coin/"]');
    if (!link) return null;
    const href = link.getAttribute('href');
    if (!href) return null;
    const parts = href.split('/coin/');
    return parts.length > 1 ? parts[1] : null;
}