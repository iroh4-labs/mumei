import { type Static, Type } from '@sinclair/typebox'

const TsField = Type.String({ format: 'date-time' })

const CommitEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('commit'),
    slug: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    ref: Type.String({ pattern: '^[0-9a-f]{7,40}$', description: 'git short or full SHA.' }),
    message: Type.String({ description: 'First line of commit message.' }),
  },
  { additionalProperties: false },
)

const ReviewEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('review'),
    slug: Type.String(),
    verdict: Type.Union([
      Type.Literal('PASS'),
      Type.Literal('NEEDS_IMPROVEMENT'),
      Type.Literal('MAJOR_ISSUES'),
    ]),
    iter: Type.Integer({ minimum: 1, maximum: 3 }),
  },
  { additionalProperties: false },
)

const PhaseLiteralUnion = Type.Union([
  Type.Literal('plan'),
  Type.Literal('implement'),
  Type.Literal('review'),
  Type.Literal('done'),
])

const PhaseEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('phase'),
    slug: Type.String(),
    from: Type.Union([PhaseLiteralUnion, Type.Null()], {
      description:
        "Previous phase. null when transition history is unavailable (no audit-log entry); UI renders as '→ <to>' in that case.",
    }),
    to: PhaseLiteralUnion,
  },
  { additionalProperties: false },
)

const HookEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('hook'),
    hook_id: Type.String({
      description:
        'Hook rule short id emitted by hooks/_lib/hook-stats.sh:mumei_hook_stats_record.',
    }),
    decision: Type.Union([
      Type.Literal('allow'),
      Type.Literal('deny'),
      Type.Literal('warn'),
      Type.Literal('block'),
      Type.Literal('noop'),
      Type.Literal('pass'),
    ]),
  },
  { additionalProperties: false },
)

const SubagentEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('subagent'),
    slug: Type.String({
      description: 'Owning feature key (REQ-N-slug for spec, bare slug for plan).',
    }),
    agent: Type.String({ description: 'Subagent name (e.g. spec-compliance-reviewer).' }),
    phase: Type.Union([Type.Literal('before'), Type.Literal('after')], {
      description: 'Cost-log phase marker; before / after for delta computation.',
    }),
    tokens_total: Type.Integer({
      minimum: 0,
      description: 'input_tokens + output_tokens at this entry.',
    }),
  },
  { additionalProperties: false },
)

const TaskProgressEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('task_progress'),
    slug: Type.String(),
    vehicle: Type.Union([Type.Literal('spec'), Type.Literal('plan')]),
    wave: Type.Optional(
      Type.Union([Type.Integer({ minimum: 1 }), Type.Null()], {
        description: 'Wave number for spec vehicle; null for plan vehicle.',
      }),
    ),
    task_id: Type.String({
      description: "Spec: <wave>.<task> like '1.2'. Plan: post-increment task counter as a string.",
    }),
  },
  { additionalProperties: false },
)

const ArchiveEventSchema = Type.Object(
  {
    ts: TsField,
    kind: Type.Literal('archive'),
    slug: Type.String(),
    to: Type.String({
      description: 'Archive destination path (.mumei/archive/<YYYY-MM>/<slug>).',
    }),
  },
  { additionalProperties: false },
)

export const ActivityEventSchema = Type.Union(
  [
    CommitEventSchema,
    ReviewEventSchema,
    PhaseEventSchema,
    HookEventSchema,
    SubagentEventSchema,
    TaskProgressEventSchema,
    ArchiveEventSchema,
  ],
  {
    $id: 'https://mumei.dev/schemas/activity-event.schema.json',
    title: 'mumei activity event',
    description:
      "Discriminated union of activity entries returned by GET /api/activity?limit=50 and prepended into ActivityFeed via SSE 'activity.added'. Producer: dashboard/server/activity.ts (merging git log + reviews/*.json + state.json mtime + .hook-stats.jsonl, active + archive). Consumer: dashboard/src/components/ActivityFeed.tsx.",
  },
)

export const ActivityEventListSchema = Type.Array(ActivityEventSchema)

export type ActivityEvent = Static<typeof ActivityEventSchema>
export type ActivityEventList = Static<typeof ActivityEventListSchema>
