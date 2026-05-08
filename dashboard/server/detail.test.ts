import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildFeatureDetail } from './detail.ts'

const PLUGIN_ROOT = '/Users/shunichi/.claude/plugins/cache/mumei/mumei/0.3.6'

describe('buildFeatureDetail', () => {
  let projectRoot: string
  beforeEach(async () => {
    projectRoot = await mkdtemp(path.join(tmpdir(), 'detail-'))
  })
  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  it('returns null for unknown feature', async () => {
    const r = await buildFeatureDetail({ projectRoot, pluginRoot: PLUGIN_ROOT, featureKey: 'nope' })
    expect(r).toBeNull()
  })

  it('parses ACs and waveplan for spec vehicle', async () => {
    const featDir = path.join(projectRoot, '.mumei', 'specs', 'REQ-1-foo')
    await mkdir(featDir, { recursive: true })
    await writeFile(
      path.join(featDir, 'state.json'),
      JSON.stringify({ id: 'REQ-1', slug: 'foo', phase: 'plan' }),
    )
    await writeFile(
      path.join(featDir, 'requirements.md'),
      [
        '# foo Requirements',
        '## Acceptance Criteria',
        '- REQ-1.1 [CONFIRMED] WHEN x, the system SHALL y.',
        '  Examples:',
        '  - happy path',
        '- REQ-1.2 [ASSUMPTION] WHILE z, the system SHALL w.',
      ].join('\n'),
    )
    await writeFile(
      path.join(featDir, 'tasks.md'),
      [
        '# foo Implementation Plan',
        '## Wave 1: schemas',
        '**Goal**: write schemas',
        '**Verify**: typecheck',
        '- [x] 1.1 first',
        '  - _Files: schemas/foo.json_',
        '  - _Depends: -_',
        '  - _Requirements: REQ-1.1_',
      ].join('\n'),
    )
    const r = await buildFeatureDetail({
      projectRoot,
      pluginRoot: PLUGIN_ROOT,
      featureKey: 'REQ-1-foo',
    })
    expect(r?.planVehicle).toBe(false)
    expect(r?.acs.length).toBe(2)
    expect(r?.acs[0]).toMatchObject({
      id: 'REQ-1.1',
      confirmed: true,
      examples: ['happy path'],
    })
    expect(r?.acs[1]?.confirmed).toBe(false)
    expect(r?.waveplan.length).toBe(1)
    expect(r?.waveplan[0]?.wave).toBe(1)
    expect(r?.waveplan[0]?.tasks[0]?.done).toBe(true)
  })

  it('returns planVehicle=true with empty acs for plan vehicle', async () => {
    const featDir = path.join(projectRoot, '.mumei', 'plans', 'fix-bug')
    await mkdir(featDir, { recursive: true })
    await writeFile(
      path.join(featDir, 'state.json'),
      JSON.stringify({ id: 'fix-bug', slug: 'fix-bug', phase: 'implement' }),
    )
    const r = await buildFeatureDetail({
      projectRoot,
      pluginRoot: PLUGIN_ROOT,
      featureKey: 'fix-bug',
    })
    expect(r?.planVehicle).toBe(true)
    expect(r?.acs).toEqual([])
  })

  it('aggregates costPerIter from per-feature cost-log', async () => {
    const featDir = path.join(projectRoot, '.mumei', 'specs', 'REQ-1-foo')
    await mkdir(featDir, { recursive: true })
    await writeFile(
      path.join(featDir, 'state.json'),
      JSON.stringify({ id: 'REQ-1', slug: 'foo', phase: 'review' }),
    )
    await writeFile(
      path.join(featDir, 'cost-log.jsonl'),
      [
        JSON.stringify({
          ts: '2026-05-08T01:00:00Z',
          feature: 'REQ-1-foo',
          phase: 'after',
          iteration: 1,
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 200,
        }),
        JSON.stringify({
          ts: '2026-05-08T02:00:00Z',
          feature: 'REQ-1-foo',
          phase: 'after',
          iteration: 2,
          input_tokens: 50,
          output_tokens: 25,
        }),
      ].join('\n'),
    )
    const r = await buildFeatureDetail({
      projectRoot,
      pluginRoot: PLUGIN_ROOT,
      featureKey: 'REQ-1-foo',
    })
    expect(r?.costPerIter).toEqual([
      { iter: 1, tokens: 150, cacheHit: 200 / 300 },
      { iter: 2, tokens: 75, cacheHit: 0 },
    ])
  })

  it('lists reviews ordered with verdicts and findings', async () => {
    const featDir = path.join(projectRoot, '.mumei', 'specs', 'REQ-1-foo')
    const reviewsDir = path.join(featDir, 'reviews')
    await mkdir(reviewsDir, { recursive: true })
    await writeFile(
      path.join(featDir, 'state.json'),
      JSON.stringify({ id: 'REQ-1', slug: 'foo', phase: 'review' }),
    )
    await writeFile(
      path.join(reviewsDir, '20260508T120000Z.json'),
      JSON.stringify({
        verdict: 'NEEDS_IMPROVEMENT',
        iteration: 2,
        wave: 1,
        findings_surfaced: [{ id: 'F-1', severity: 'HIGH', category: 'security', message: 'leak' }],
      }),
    )
    const r = await buildFeatureDetail({
      projectRoot,
      pluginRoot: PLUGIN_ROOT,
      featureKey: 'REQ-1-foo',
    })
    expect(r?.reviews.length).toBe(1)
    expect(r?.reviews[0]?.verdict).toBe('NEEDS_IMPROVEMENT')
    expect(r?.reviews[0]?.findings?.[0]?.message).toBe('leak')
  })
})
