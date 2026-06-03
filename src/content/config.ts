export const LOGO_PATH = 'https://bkewrxrsckiwxdyunbfl.supabase.co/storage/v1/object/public/periscanner/clusters/periscanner_logo.png'
export const PROD_API_URL = 'https://scanner-api.unknown-pluis.workers.dev/api/v1'
export const DEV_API_URL = 'http://localhost:8799/api/v1'

// Webapp base URL (cluster/leaderboard pages the extension links out to).
// Currently the Cloudflare Pages deployment — swap here when the real domain lands.
export const WEBAPP_URL = 'https://periscanner.pages.dev'

// Dev builds (`vite` / `pnpm dev`) hit the local worker; production builds
// (`vite build`) hit the deployed worker. import.meta.env.DEV is injected by Vite.
export const API_URL = import.meta.env.DEV ? DEV_API_URL : PROD_API_URL