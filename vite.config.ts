import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import manifest from './manifest.config.ts'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    vue(),
    crx({ manifest }),
    tailwindcss(),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})