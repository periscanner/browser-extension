import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.ts'
import { name, version } from './package.json'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    vue(),
    crx({ manifest }),
    tailwindcss(),
    zip({
      inDir: path.resolve(__dirname, 'dist'), // Absolute path to dist
      outDir: path.resolve(__dirname, 'release'), // Absolute path to release
      outFileName: `crx-${name}-${version}.zip`,
      pathPrefix: ''
    }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
  build: {
    emptyOutDir: true, // Ensures a clean dist before zipping
  }
})