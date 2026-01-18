export default function extractTokenAddress(html: string): string | null {
  // Regex is significantly faster than DOMParser for extracting a specific pattern from a string
  // Avoids parsing the entire HTML structure
  const match = html.match(/pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
  return match ? match[1] : null;
}
