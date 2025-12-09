import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo/LOGO_CIRCLE_48x48.webp',
  },
  action: {
    default_icon: {
      48: 'public/logo/LOGO_CIRCLE_48x48.webp',
    },
  },
  permissions: [
    'sidePanel',
    'contentSettings',
  ],
  background: {
    service_worker: 'src/background.ts',
  },
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://axiom.trade/*', 'https://trade.padre.gg/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})