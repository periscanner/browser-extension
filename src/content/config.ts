export const LOGO_PATH = 'https://bkewrxrsckiwxdyunbfl.supabase.co/storage/v1/object/public/periscanner/clusters/periscanner_logo.png'
export const PROD_API_URL = 'https://scanner-api.unknown-pluis.workers.dev/api'
export const DEV_API_URL = 'http://localhost:8799/api'

// Dev builds (`vite` / `pnpm dev`) hit the local worker; production builds
// (`vite build`) hit the deployed worker. import.meta.env.DEV is injected by Vite.
export const API_URL = import.meta.env.DEV ? DEV_API_URL : PROD_API_URL