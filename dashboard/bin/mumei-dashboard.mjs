#!/usr/bin/env node
// Entry point for `npx mumei-dashboard`. Boots the Fastify server in
// the user's current working directory (which is read as the project
// root). The Vite dev server is a separate concern handled by
// `npm run dev` from the dashboard repo; the published bin always
// runs the prebuilt server bundle (`dist/server/index.js`).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

const arg = process.argv[2]
if (arg === '--version' || arg === '-v' || arg === 'version') {
  const pkg = JSON.parse(readFileSync(path.resolve(here, '../package.json'), 'utf8'))
  process.stdout.write(`${pkg.version}\n`)
  process.exit(0)
}
if (arg === '--help' || arg === '-h' || arg === 'help') {
  process.stdout.write(`mumei-dashboard — local web UI for the mumei plugin

Usage:
  mumei-dashboard            Start the dashboard server (default port 3001)
  mumei-dashboard --version  Print version and exit
  mumei-dashboard --help     Show this help and exit

The server reads .mumei/ from the current working directory and serves
the dashboard at http://127.0.0.1:<port>. Override the port with the
MUMEI_DASHBOARD_PORT environment variable.
`)
  process.exit(0)
}

const builtEntry = path.resolve(here, '../dist/server/index.js')
const sourceEntry = path.resolve(here, '../server/index.ts')

let entry = builtEntry
if (!existsSync(builtEntry)) {
  if (existsSync(sourceEntry)) {
    // Local checkout fallback — let the developer run via tsx.
    const { spawn } = await import('node:child_process')
    const child = spawn(process.execPath, ['--import', 'tsx', sourceEntry], {
      stdio: 'inherit',
      env: process.env,
    })
    child.on('exit', (code) => process.exit(code ?? 0))
    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
  } else {
    console.error(
      'mumei-dashboard: no built server found at dist/server/index.js. Run `npm run build:server`.',
    )
    process.exit(1)
  }
} else {
  await import(pathToFileURL(entry).href)
}
