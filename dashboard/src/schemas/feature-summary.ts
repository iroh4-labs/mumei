import { type Static, Type } from '@sinclair/typebox'

const PhaseSchema = Type.Union([
  Type.Literal('plan'),
  Type.Literal('implement'),
  Type.Literal('review'),
  Type.Literal('done'),
])

const VerdictSchema = Type.Union([
  Type.Literal('PASS'),
  Type.Literal('NEEDS_IMPROVEMENT'),
  Type.Literal('MAJOR_ISSUES'),
])

export const FeatureSummarySchema = Type.Object(
  {
    id: Type.String({
      pattern: '^(REQ-[0-9]+|[a-z0-9][a-z0-9-]*)$',
      description: 'REQ-N for spec vehicle, equals slug for plan vehicle.',
    }),
    slug: Type.String({
      pattern: '^[a-z0-9][a-z0-9-]*$',
      description: 'Kebab-case feature name.',
    }),
    vehicle: Type.Union([Type.Literal('spec'), Type.Literal('plan')]),
    phase: PhaseSchema,
    nextPhase: Type.Union([PhaseSchema, Type.Null()], {
      description: 'Predicted next phase under normal flow; null when done.',
    }),
    currentWave: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()], {
      description: 'Active Wave for spec vehicle. Null for plan vehicle (no Wave concept).',
    }),
    totalWaves: Type.Integer({
      minimum: 0,
      description:
        "Spec vehicle: count of '## Wave N:' headers in tasks.md. Plan vehicle: task_created_count.",
    }),
    waveProgress: Type.Integer({
      minimum: 0,
      description: 'Spec vehicle: completed Waves (committed). Plan vehicle: task_completed_count.',
    }),
    lastVerdict: Type.Union([VerdictSchema, Type.Null()], {
      description:
        'Verdict from the most recent review JSON (Phase 5 / /mumei:review). Null when no review has run yet.',
    }),
    lastIter: Type.Union([Type.Integer({ minimum: 1, maximum: 3 }), Type.Null()]),
    tokens: Type.Integer({
      minimum: 0,
      description:
        'Sum of input_tokens + output_tokens from cost-log.jsonl entries (phase=after) for this feature.',
    }),
    cacheHit: Type.Number({
      minimum: 0,
      maximum: 1,
      description:
        'cache_read_input_tokens / (input_tokens + cache_read_input_tokens). NaN treated as 0.',
    }),
    lastActivityMin: Type.Integer({
      minimum: 0,
      description:
        'Minutes since the most recent of: state.json mtime, latest commit touching feature paths, latest cost-log entry.',
    }),
    pulse: Type.Union([Type.Literal('active'), Type.Literal('idle'), Type.Literal('stalled')], {
      description: 'Derived from lastActivityMin: <60 active, <1440 idle, else stalled.',
    }),
    findings: Type.Object(
      {
        high: Type.Integer({ minimum: 0 }),
        medium: Type.Integer({ minimum: 0 }),
        low: Type.Integer({ minimum: 0 }),
      },
      {
        additionalProperties: false,
        description: 'Surfaced findings count from latest review JSON.',
      },
    ),
    archived: Type.Boolean({
      description:
        'True when feature lives under .mumei/archive/<YYYY-MM>/<slug>/. Frontend collapses these into a separate section.',
    }),
  },
  {
    $id: 'https://mumei.dev/schemas/feature-summary.schema.json',
    title: 'mumei feature summary',
    description:
      'Per-feature roll-up returned by GET /api/features. Computed by dashboard/server/features.ts from .mumei/specs/<f>/state.json + .mumei/plans/<f>/state.json + cost-log.jsonl + git log + tasks.md. Producer: dashboard backend. Consumer: dashboard frontend (Dashboard, DetailPanel header). Backward-compatibility: existing fields MUST NOT be renamed or removed (REQ-15.21); add-only.',
    additionalProperties: false,
  },
)

export const FeatureSummaryListSchema = Type.Array(FeatureSummarySchema)

export type FeatureSummary = Static<typeof FeatureSummarySchema>
export type FeatureSummaryList = Static<typeof FeatureSummaryListSchema>
