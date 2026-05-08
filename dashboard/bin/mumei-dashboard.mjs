#!/usr/bin/env node
// Entry point for `npx @mumei/dashboard`. Boots the Fastify server in
// the user's current working directory (which is read as the project
// root). The Vite dev server is a separate concern; production builds
// serve static dist/ via Fastify directly (added in v0.2).

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverEntry = path.resolve(here, '../server/index.ts')

const child = spawn(process.execPath, ['--import', 'tsx', serverEntry], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
