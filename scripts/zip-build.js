import { readFileSync } from 'node:fs'
import { createWriteStream, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import archiver from 'archiver'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const distDir = resolve('dist')
const releaseDir = resolve('release')
const outputPath = join(releaseDir, `crx-${pkg.name}-${pkg.version}.zip`)

// Create release directory if it doesn't exist
mkdirSync(releaseDir, { recursive: true })

// Create a file to stream archive data to
const output = createWriteStream(outputPath)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`✅ Created ${outputPath} (${archive.pointer()} bytes)`)
})

archive.on('error', (err) => {
  throw err
})

// Pipe archive data to the file
archive.pipe(output)

// Add all files from dist directory at root level (not in a dist folder)
archive.directory(distDir, false)

// Finalize the archive
archive.finalize()