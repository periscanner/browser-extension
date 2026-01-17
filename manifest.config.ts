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
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['https://axiom.trade/*'],
  }],
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
    'https://fibjnghzdogyhjzubokf.supabase.co/*'
  ]
})