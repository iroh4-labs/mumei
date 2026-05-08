import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  aggregateHooksTopN,
  aggregateReviewsByDay,
  aggregateTokensByDay,
  type DailyTokenBucket,
  type DailyVerdictBucket,
  type HookCount,
} from './lib/aggregator.ts'

/**
 * GET /api/trends/tokens?days=N
 * Returns daily token totals across active + archive cost-log files.
 */
export async function trendTokens(args: {
  projectRoot: string
  days: number
  now?: Date
}): Promise<DailyTokenBucket[]> {
  const files = await collectCostLogFiles(args.projectRoot)
  return aggregateTokensByDay(files, args.days, args.now)
}

/**
 * GET /api/trends/reviews?days=N
 * Returns daily verdict counts (PASS / NEEDS_IMPROVEMENT / MAJOR_ISSUES)
 * across active + archive review dirs.
 */
export async function trendReviews(args: {
  projectRoot: string
  days: number
  now?: Date
}): Promise<DailyVerdictBucket[]> {
  const dirs = await collectReviewDirs(args.projectRoot)
  return aggregateReviewsByDay(dirs, args.days, args.now)
}

/**
 * GET /api/trends/hooks?topN=N&windowH=H
 */
export async function trendHooks(args: {
  projectRoot: string
  topN: number
  windowH: number
  now?: Date
}): Promise<HookCount[]> {
  const file = path.join(args.projectRoot, '.mumei', '.hook-stats.jsonl')
  return aggregateHooksTopN(file, args.topN, args.windowH, args.now)
}

async function collectCostLogFiles(projectRoot: string): Promise<string[]> {
  const mumeiDir = path.join(projectRoot, '.mumei')
  const out: string[] = [path.join(mumeiDir, 'cost-log.jsonl')]
  for (const sub of ['specs', 'plans']) {
    const dir = path.join(mumeiDir, sub)
    for (const ent of await safeReaddir(dir)) {
      if (ent.isDirectory()) out.push(path.join(dir, ent.name, 'cost-log.jsonl'))
    }
  }
  const archiveRoot = path.join(mumeiDir, 'archive')
  for (const month of await safeReaddir(archiveRoot)) {
    if (!month.isDirectory()) continue
    const monthDir = path.join(archiveRoot, month.name)
    for (const slug of await safeReaddir(monthDir)) {
      if (slug.isDirectory()) out.push(path.join(monthDir, slug.name, 'cost-log.jsonl'))
    }
  }
  return out
}

async function collectReviewDirs(projectRoot: string): Promise<string[]> {
  const mumeiDir = path.join(projectRoot, '.mumei')
  const out: string[] = []
  for (const sub of ['specs', 'plans']) {
    const dir = path.join(mumeiDir, sub)
    for (const ent of await safeReaddir(dir)) {
      if (ent.isDirectory()) out.push(path.join(dir, ent.name, 'reviews'))
    }
  }
  const archiveRoot = path.join(mumeiDir, 'archive')
  for (const month of await safeReaddir(archiveRoot)) {
    if (!month.isDirectory()) continue
    const monthDir = path.join(archiveRoot, month.name)
    for (const slug of await safeReaddir(monthDir)) {
      if (slug.isDirectory()) out.push(path.join(monthDir, slug.name, 'reviews'))
    }
  }
  return out
}

async function safeReaddir(
  dir: string,
): Promise<{ name: string; isFile: () => boolean; isDirectory: () => boolean }[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
}
