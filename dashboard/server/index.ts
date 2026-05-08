import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { watch } from 'chokidar'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { listFeatures } from './features.ts'

const exec = promisify(execFile)

// CWD when started: the user's project root. We read .mumei/ relative
// to it. The `cwd` arg lets `npx @mumei/dashboard` work from any path.
const PROJECT_ROOT = process.cwd()
const MUMEI_DIR = path.join(PROJECT_ROOT, '.mumei')
const PORT = Number(process.env.MUMEI_DASHBOARD_PORT ?? '3001')

const app = Fastify({
  logger: { level: process.env.MUMEI_DASHBOARD_LOG_LEVEL ?? 'info' },
})

// ---------------------------------------------------------------------------
// REST: /api/features — full feature summary list, sorted active-first
// ---------------------------------------------------------------------------
app.get('/api/features', async () => {
  return listFeatures(PROJECT_ROOT)
})

// ---------------------------------------------------------------------------
// REST: /api/cost?feature=<f> — cost-log JSON via aggregate-cost.sh
// ---------------------------------------------------------------------------
app.get<{ Querystring: { feature?: string } }>('/api/cost', async (req, reply) => {
  const feature = req.query.feature
  if (!feature) {
    reply.code(400)
    return { error: 'feature param required' }
  }
  try {
    const { stdout } = await exec('bash', [
      path.join(PROJECT_ROOT, 'scripts/aggregate-cost.sh'),
      '--json',
      feature,
    ])
    return JSON.parse(stdout)
  } catch (err) {
    reply.code(500)
    return { error: 'aggregate-cost failed', detail: String(err) }
  }
})

// ---------------------------------------------------------------------------
// REST: /api/hook-stats — JSON with by_decision, by_hook_id, by_month
// ---------------------------------------------------------------------------
app.get('/api/hook-stats', async (_req, reply) => {
  try {
    const { stdout } = await exec('bash', [
      path.join(PROJECT_ROOT, 'scripts/aggregate-hook-stats.sh'),
      '--json',
    ])
    return JSON.parse(stdout)
  } catch (err) {
    reply.code(500)
    return { error: 'aggregate-hook-stats failed', detail: String(err) }
  }
})

// ---------------------------------------------------------------------------
// REST: /api/feature/:slug/{requirements,design,tasks,review-latest}
// Read-only file accessors. Useful for the detail panel.
// ---------------------------------------------------------------------------
app.get<{ Params: { slug: string; doc: string } }>(
  '/api/feature/:slug/:doc',
  async (req, reply) => {
    const allowed = new Set(['requirements', 'design', 'tasks'])
    if (!allowed.has(req.params.doc)) {
      reply.code(404)
      return { error: 'unknown doc' }
    }
    const candidates = [
      path.join(MUMEI_DIR, 'specs', req.params.slug, `${req.params.doc}.md`),
      path.join(MUMEI_DIR, 'plans', req.params.slug, `${req.params.doc}.md`),
    ]
    for (const p of candidates) {
      try {
        const body = await readFile(p, 'utf8')
        reply.type('text/markdown')
        return body
      } catch {
        /* try next */
      }
    }
    reply.code(404)
    return { error: 'not found' }
  },
)

// ---------------------------------------------------------------------------
// SSE: /events — push feature.* and heartbeat events to subscribers
// ---------------------------------------------------------------------------
type SseClient = { id: number; reply: FastifyReply }
const clients = new Set<SseClient>()
let nextClientId = 1

app.get('/events', (req: FastifyRequest, reply: FastifyReply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.flushHeaders?.()

  const client: SseClient = { id: nextClientId++, reply }
  clients.add(client)
  app.log.info({ clientId: client.id, total: clients.size }, 'sse client connected')

  // Initial heartbeat so EventSource transitions to OPEN immediately.
  reply.raw.write(`data: ${JSON.stringify({ kind: 'heartbeat', ts: new Date().toISOString() })}\n\n`)

  req.raw.on('close', () => {
    clients.delete(client)
    app.log.info({ clientId: client.id, total: clients.size }, 'sse client disconnected')
  })
})

function broadcast(event: object): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const c of clients) {
    try {
      c.reply.raw.write(payload)
    } catch (err) {
      app.log.warn({ err, clientId: c.id }, 'sse broadcast failed; dropping client')
      clients.delete(c)
    }
  }
}

// 25s heartbeat to keep proxies / load balancers from idling the socket.
setInterval(() => {
  broadcast({ kind: 'heartbeat', ts: new Date().toISOString() })
}, 25_000)

// ---------------------------------------------------------------------------
// Watch .mumei/ — push feature.* events on change
// ---------------------------------------------------------------------------
const watcher = watch(MUMEI_DIR, {
  ignored: (target: string) => target.includes('/.hook-stats.jsonl.rotate.lock'),
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
})

watcher.on('all', (event, target) => {
  // Map filesystem path → feature compound-key.
  // .mumei/specs/REQ-14-foo/state.json → "REQ-14-foo"
  // .mumei/plans/fix-bug/state.json    → "fix-bug"
  const rel = path.relative(MUMEI_DIR, target)
  const segments = rel.split(path.sep)
  const subroot = segments[0] // 'specs' | 'plans' | 'archive' | 'scratch' | ...
  const featureKey = segments[1]
  if (!featureKey) return

  if (subroot === 'specs' || subroot === 'plans') {
    if (segments[2] === 'reviews' && /\.json$/.test(target)) {
      broadcast({
        kind: 'review.added',
        feature: featureKey,
        ts: new Date().toISOString(),
        verdict: 'NEEDS_IMPROVEMENT', // placeholder; client refetches anyway
      })
      return
    }
    if (event === 'add' || event === 'addDir') {
      broadcast({ kind: 'feature.created', feature: featureKey, ts: new Date().toISOString() })
      return
    }
    if (event === 'unlinkDir') {
      broadcast({ kind: 'feature.archived', feature: featureKey, ts: new Date().toISOString() })
      return
    }
    broadcast({ kind: 'feature.update', feature: featureKey, ts: new Date().toISOString() })
  }
})

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
app.listen({ port: PORT, host: '127.0.0.1' }, (err, addr) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info({ addr, projectRoot: PROJECT_ROOT, mumei: MUMEI_DIR }, 'mumei-dashboard server up')
})

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'shutting down')
  await watcher.close()
  await app.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
