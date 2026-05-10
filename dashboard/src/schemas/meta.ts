import { type Static, Type } from '@sinclair/typebox'

export const MetaSchema = Type.Object(
  {
    projectLabel: Type.String({
      description:
        "process.cwd() converted to '~/...' when under $HOME, else the absolute path. Computed by dashboard/server/lib/path.ts.",
    }),
  },
  {
    $id: 'https://mumei.dev/schemas/meta.schema.json#v0.1.0',
    title: 'mumei dashboard meta',
    description:
      'Backend identity used by the TopBar. Producer: dashboard/server/meta.ts. Consumer: dashboard/src/hooks/useMeta.ts.',
    additionalProperties: false,
  },
)

export const MetaStatsSchema = Type.Object(
  {
    activeCount: Type.Integer({
      minimum: 0,
      description: "Count of features with phase != 'done' across .mumei/specs/ and .mumei/plans/.",
    }),
    monthTokens: Type.Integer({
      minimum: 0,
      description:
        'Sum of input_tokens + output_tokens for cost-log entries this calendar month (UTC).',
    }),
    cacheHitRate: Type.Number({
      minimum: 0,
      maximum: 1,
      description:
        'Project-wide cache_read_input_tokens / (input_tokens + cache_read_input_tokens) for the current month.',
    }),
    hooksPerSec: Type.Number({
      minimum: 0,
      description:
        '24-hour rolling average firing rate computed from .hook-stats.jsonl. 0 when the file is absent.',
    }),
    eventCount24h: Type.Integer({
      minimum: 0,
      description:
        'Count of activity events (commits + reviews + hooks + phase changes) in the last 24 hours.',
    }),
  },
  {
    $id: 'https://mumei.dev/schemas/meta-stats.schema.json#v0.1.0',
    title: 'mumei dashboard meta stats',
    description:
      'Aggregate counters used by the TopBar. Producer: dashboard/server/meta.ts. Consumer: dashboard/src/hooks/useMeta.ts.',
    additionalProperties: false,
  },
)

export type Meta = Static<typeof MetaSchema>
export type MetaStats = Static<typeof MetaStatsSchema>
