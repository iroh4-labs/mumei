import { type Static, Type } from '@sinclair/typebox'

const TimelineEntrySchema = Type.Object(
  {
    ts: Type.String({ format: 'date-time' }),
    event: Type.String({
      description:
        "Short label, e.g. 'created', 'phase: plan -> implement', 'wave 2 commit', 'review iter 1 PASS'.",
    }),
    ref: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: 'git rev / review JSON path / null.',
      }),
    ),
  },
  { additionalProperties: false },
)

const AcSchema = Type.Object(
  {
    id: Type.String({ pattern: '^REQ-[0-9]+\\.[0-9]+(\\.[0-9]+)?$' }),
    body: Type.String(),
    confirmed: Type.Boolean({
      description: 'True for [CONFIRMED] ACs, false for [ASSUMPTION] / [NEEDS CLARIFICATION].',
    }),
    examples: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
)

const TaskSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[0-9]+\\.[0-9]+$' }),
    description: Type.String(),
    done: Type.Boolean(),
    files: Type.Array(Type.String()),
    depends: Type.Array(Type.String()),
    reqs: Type.Array(Type.String()),
  },
  { additionalProperties: false },
)

const WaveplanEntrySchema = Type.Object(
  {
    wave: Type.Integer({ minimum: 1 }),
    goal: Type.String(),
    verify: Type.String(),
    tasks: Type.Array(TaskSchema),
  },
  { additionalProperties: false },
)

const FindingShortSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    severity: Type.Union([
      Type.Literal('LOW'),
      Type.Literal('MEDIUM'),
      Type.Literal('HIGH'),
      Type.Literal('CRITICAL'),
    ]),
    category: Type.Optional(Type.String()),
    message: Type.String(),
  },
  { additionalProperties: true },
)

const ReviewSummarySchema = Type.Object(
  {
    ts: Type.String({ format: 'date-time' }),
    verdict: Type.Union([
      Type.Literal('PASS'),
      Type.Literal('NEEDS_IMPROVEMENT'),
      Type.Literal('MAJOR_ISSUES'),
    ]),
    iteration: Type.Integer({ minimum: 1, maximum: 3 }),
    wave: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('all')])),
    findings: Type.Optional(Type.Array(FindingShortSchema)),
  },
  { additionalProperties: false },
)

const CostPerIterSchema = Type.Object(
  {
    iter: Type.Integer({ minimum: 1, maximum: 3 }),
    tokens: Type.Integer({ minimum: 0 }),
    cacheHit: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
)

export const FeatureDetailSchema = Type.Object(
  {
    slug: Type.String({ pattern: '^[a-z0-9][a-z0-9-]*$' }),
    planVehicle: Type.Boolean({
      description:
        "True when feature lives under .mumei/plans/<slug>/ (no requirements.md). Frontend renders 'no requirements (plan vehicle)' placeholder for the ACs tab.",
    }),
    archived: Type.Optional(
      Type.Boolean({
        description:
          "True when the feature was found under .mumei/archive/<YYYY-MM>/<slug>/ instead of active specs/plans. Frontend may surface an 'archived' badge to signal that further realtime updates will not arrive (REQ-18.15).",
      }),
    ),
    timeline: Type.Array(TimelineEntrySchema),
    acs: Type.Array(AcSchema, { description: 'Empty array when planVehicle=true.' }),
    waveplan: Type.Array(WaveplanEntrySchema),
    reviews: Type.Array(ReviewSummarySchema),
    costPerIter: Type.Array(CostPerIterSchema),
  },
  {
    $id: 'https://mumei.dev/schemas/feature-detail.schema.json',
    title: 'mumei feature detail payload',
    description:
      'GET /api/feature/:slug/detail result built by dashboard/server/detail.ts from requirements.md + tasks.md (via execFile bash hooks/_lib/tasks.sh) + reviews/*.json + cost-log.jsonl. When planVehicle=true, requirements.md is absent so acs is []. Producer: dashboard backend. Consumer: DetailPanel.tsx.',
    additionalProperties: false,
  },
)

export type FeatureDetail = Static<typeof FeatureDetailSchema>
