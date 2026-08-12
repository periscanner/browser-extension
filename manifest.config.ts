import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo/LOGO_CIRCLE_48x48.png',
  },
  action: {
    default_icon: {
      48: 'public/logo/LOGO_CIRCLE_48x48.png',
    },
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      matches: ['https://axiom.trade/*'],
    },
    // MAIN-world bridge for the OG lineage strip (src/content/ui/ogStrip.ts):
    // isolated-world content scripts can't see the page's window.next, so
    // this tiny main-world script does the actual SPA router.push on its
    // behalf (src/content/mainworld.ts). Must run at document_start so the
    // listener is attached before the strip can dispatch a navigation event.
    {
      js: ['src/content/mainworld.ts'],
      matches: ['https://axiom.trade/*'],
      run_at: 'document_start',
      world: 'MAIN',
    },
  ],
  background: {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'activeTab' // Added to help with message passing
  ],
  // ADDED: Crucial for allowing fetch calls to your API
  host_permissions: [
    'https://bkewrxrsckiwxdyunbfl.supabase.co/*',
    'https://scanner-api.unknown-pluis.workers.dev/*'
  ]
})