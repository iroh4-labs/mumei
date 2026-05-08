import { EventEmitter } from 'node:events'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { MumeiActivityEvent } from '../src/types/activity-event.ts'
import type { MumeiDashboardSSEEvent } from '../src/types/sse-event.ts'
import { type RawFsEvent, startFsWatcher } from './lib/fs-watch.ts'

const DEBOUNCE_MS = 200

type EmitFn = (event: MumeiDashboardSSEEvent) => void

/**
 * Chokidar fs events come fast and noisy (state.json written via mktemp+mv
 * arrives as add+unlink+add). Debounce per (eventType, slug) for 200ms so
 * the wire only sees one feature.update per coalesced burst.
 */
class Debouncer {
  private timers = new Map<string, NodeJS.Timeout>()

  schedule(key: string, ms: number, fn: () => void): void {
    const existing = this.timers.get(key)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      this.timers.delete(key)
      fn()
    }, ms)
    this.timers.set(key, t)
  }

  clear(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }
}

export interface SseRegistration {
  emit: EmitFn
  close: () => Promise<void>
  /** Test seam: trigger a synthetic raw fs event without touching the disk. */
  injectRawForTest: (event: RawFsEvent) => void
  /** Test seam: observe every event after it has been broadcast. */
  subscribeForTest: (fn: (event: MumeiDashboardSSEEvent) => void) => () => void
}

/**
 * Mount /api/events on the Fastify app, start the chokidar watcher
 * for `<projectRoot>/.mumei/`, and return a handle whose `emit` can
 * be used to push out-of-band events from other modules.
 */
export function registerSse(
  app: FastifyInstance,
  args: {
    projectRoot: string
    debounceMs?: number
    ignoreInitial?: boolean
  },
): SseRegistration {
  const debounceMs = args.debounceMs ?? DEBOUNCE_MS
  const clients = new Set<{ id: number; reply: FastifyReply }>()
  let nextId = 1
  const internalBus = new EventEmitter()
  const debouncer = new Debouncer()

  const observers = new Set<(event: MumeiDashboardSSEEvent) => void>()
  const broadcast: EmitFn = (event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const c of clients) {
      try {
        c.reply.raw.write(payload)
      } catch (err) {
        app.log.warn({ err, clientId: c.id }, 'sse broadcast failed; dropping client')
        clients.delete(c)
      }
    }
    for (const fn of observers) {
      try {
        fn(event)
      } catch (err) {
        app.log.warn({ err }, 'sse observer threw')
      }
    }
  }

  const watcher = startFsWatcher({
    projectRoot: args.projectRoot,
    ignoreInitial: args.ignoreInitial,
  })
  watcher.emitter.on('event', (raw: RawFsEvent) => {
    handleRawEvent(raw, args.projectRoot, broadcast, debouncer, debounceMs).catch((err) =>
      app.log.error({ err }, 'sse handleRawEvent failed'),
    )
  })

  // Heartbeat every 25s to keep proxies from idling out the connection.
  const hb = setInterval(() => {
    for (const c of clients) {
      try {
        c.reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`)
      } catch {
        clients.delete(c)
      }
    }
  }, 25_000)

  app.get('/api/events', (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders?.()

    const c = { id: nextId++, reply }
    clients.add(c)
    app.log.info({ clientId: c.id, total: clients.size }, 'sse client connected')

    // Initial open ping so EventSource transitions to OPEN immediately.
    reply.raw.write(`: open ${new Date().toISOString()}\n\n`)

    req.raw.on('close', () => {
      clients.delete(c)
      app.log.info({ clientId: c.id, total: clients.size }, 'sse client disconnected')
    })
  })

  return {
    emit: broadcast,
    injectRawForTest: (raw) => {
      handleRawEvent(raw, args.projectRoot, broadcast, debouncer, debounceMs).catch((err) =>
        app.log.error({ err }, 'sse handleRawEvent (test) failed'),
      )
    },
    subscribeForTest: (fn) => {
      observers.add(fn)
      return () => observers.delete(fn)
    },
    close: async () => {
      clearInterval(hb)
      debouncer.clear()
      await watcher.close()
      internalBus.removeAllListeners()
      for (const c of clients) {
        try {
          c.reply.raw.end()
        } catch {
          // ignore
        }
      }
      clients.clear()
      observers.clear()
    },
  }
}

async function handleRawEvent(
  raw: RawFsEvent,
  projectRoot: string,
  emit: EmitFn,
  debouncer: Debouncer,
  debounceMs: number,
): Promise<void> {
  switch (raw.kind) {
    case 'state': {
      if (!raw.slug) return
      const slug = raw.slug
      // state.json updates emit BOTH feature.update AND activity.added
      // per REQ-15.15 dual-emit invariant.
      debouncer.schedule(`feature.update::${slug}`, debounceMs, () =>
        emit({ type: 'feature.update', slug }),
      )
      debouncer.schedule(`activity.added::phase::${slug}`, debounceMs, async () => {
        const phase = await readPhase(raw.filePath)
        if (!phase) return
        emit({
          type: 'activity.added',
          event: {
            ts: new Date().toISOString(),
            kind: 'phase',
            slug,
            from: phase,
            to: phase,
          } as MumeiActivityEvent,
        })
      })
      return
    }
    case 'cost-log': {
      const slug = raw.slug ?? null
      const key = `cost.updated::${slug ?? '*'}`
      debouncer.schedule(key, debounceMs, () => emit({ type: 'cost.updated', slug }))
      return
    }
    case 'review': {
      if (!raw.slug) return
      const slug = raw.slug
      debouncer.schedule(`activity.added::review::${slug}`, debounceMs, () => {
        emit({
          type: 'activity.added',
          event: {
            ts: new Date().toISOString(),
            kind: 'review',
            slug,
            verdict: 'PASS', // placeholder; client refetches the latest review JSON
            iter: 1,
          } as MumeiActivityEvent,
        })
      })
      return
    }
    case 'hook-stats': {
      // Project-wide; coalesce all changes.
      debouncer.schedule('activity.added::hook::*', debounceMs, () => {
        emit({
          type: 'activity.added',
          event: {
            ts: new Date().toISOString(),
            kind: 'hook',
            rule_id: 'aggregate',
            decision: 'noop',
          } as MumeiActivityEvent,
        })
      })
      return
    }
  }
  // unreachable
  void projectRoot
}

async function readPhase(
  stateFile: string,
): Promise<'plan' | 'implement' | 'review' | 'done' | null> {
  try {
    await stat(stateFile)
  } catch {
    return null
  }
  try {
    const fs = await import('node:fs/promises')
    const body = await fs.readFile(stateFile, 'utf8')
    const parsed = JSON.parse(body) as { phase?: string }
    const phase = parsed.phase
    if (phase === 'plan' || phase === 'implement' || phase === 'review' || phase === 'done') {
      return phase
    }
    return null
  } catch {
    return null
  }
}

// path import kept for re-use if needed downstream
void path
