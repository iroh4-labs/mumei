import { type Static, Type } from '@sinclair/typebox'

const InlineActivityEventSchema = Type.Union([
  Type.Object(
    {
      ts: Type.String({ format: 'date-time' }),
      kind: Type.Literal('commit'),
      slug: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      ref: Type.String({ pattern: '^[0-9a-f]{7,40}$' }),
      message: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ts: Type.String({ format: 'date-time' }),
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
  ),
  Type.Object(
    {
      ts: Type.String({ format: 'date-time' }),
      kind: Type.Literal('phase'),
      slug: Type.String(),
      from: Type.Union([
        Type.Literal('plan'),
        Type.Literal('implement'),
        Type.Literal('review'),
        Type.Literal('done'),
      ]),
      to: Type.Union([
        Type.Literal('plan'),
        Type.Literal('implement'),
        Type.Literal('review'),
        Type.Literal('done'),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ts: Type.String({ format: 'date-time' }),
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
      ]),
    },
    { additionalProperties: false },
  ),
])

const FeatureUpdateEventSchema = Type.Object(
  {
    type: Type.Literal('feature.update'),
    slug: Type.Optional(
      Type.String({
        pattern: '^(REQ-[0-9]+(-[a-z0-9-]+)?|[a-z0-9][a-z0-9-]*)$',
        description:
          "Feature key whose state.json or review changed (REQ-N-slug for spec, bare slug for plan); useEventStream invalidates ['features'], ['feature', slug, 'detail'], AND ['meta','stats']. Omit when the change is project-wide (e.g. .hook-stats.jsonl) and only `affects` is meaningful.",
      }),
    ),
    affects: Type.Optional(
      Type.Array(
        Type.Union([Type.Literal('hooks'), Type.Literal('reviews'), Type.Literal('tokens')]),
        {
          uniqueItems: true,
          description:
            "Trend kinds whose underlying data changed. useEventStream invalidates `['trend', kind, ...]` for each entry, in addition to the slug-scoped invalidations above. Omit when no trend is affected.",
        },
      ),
    ),
  },
  { additionalProperties: false },
)

const CostUpdatedEventSchema = Type.Object(
  {
    type: Type.Literal('cost.updated'),
    slug: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: 'Feature slug owning the cost-log, or null when the change was project-wide.',
      }),
    ),
  },
  { additionalProperties: false },
)

const ActivityChangedEventSchema = Type.Object(
  {
    type: Type.Literal('activity.changed'),
  },
  { additionalProperties: false },
)

const ActivityAddedEventSchema = Type.Object(
  {
    type: Type.Literal('activity.added'),
    event: InlineActivityEventSchema,
  },
  { additionalProperties: false },
)

export const SseEventSchema = Type.Union(
  [
    FeatureUpdateEventSchema,
    CostUpdatedEventSchema,
    ActivityChangedEventSchema,
    ActivityAddedEventSchema,
  ],
  {
    $id: 'https://mumei.dev/schemas/sse-event.schema.json#v0.1.0',
    title: 'mumei dashboard SSE event',
    description:
      'Server-Sent Events emitted by dashboard/server/sse.ts on /api/events. All events are debounced 200ms per (event, slug). state.json updates emit BOTH feature.update AND activity.changed; review/hook activity emits only activity.changed. The client treats activity.changed and activity.added as cache-invalidation triggers and refetches /api/activity. Producer: backend chokidar -> EventEmitter pipeline. Consumer: dashboard/src/hooks/useEventStream.ts.',
  },
)

export type SseEvent = Static<typeof SseEventSchema>
