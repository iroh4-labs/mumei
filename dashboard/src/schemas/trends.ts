import { type Static, Type } from '@sinclair/typebox'

const DayKeySchema = Type.String({
  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
  description: 'ISO calendar day (UTC), zero-padded.',
})

export const TokensTrendSchema = Type.Array(
  Type.Object(
    {
      d: DayKeySchema,
      v: Type.Integer({ minimum: 0 }),
    },
    { additionalProperties: false },
  ),
  {
    $id: 'https://mumei.dev/schemas/tokens-trend.schema.json',
    title: 'mumei tokens trend',
    description:
      'GET /api/trends/tokens?days=14 result. Daily total of input + output tokens from cost-log.jsonl. Days with no entries are emitted as v=0.',
  },
)

export const ReviewsTrendSchema = Type.Array(
  Type.Object(
    {
      d: DayKeySchema,
      PASS: Type.Integer({ minimum: 0 }),
      NI: Type.Integer({ minimum: 0, description: 'NEEDS_IMPROVEMENT count.' }),
      MI: Type.Integer({ minimum: 0, description: 'MAJOR_ISSUES count.' }),
    },
    { additionalProperties: false },
  ),
  {
    $id: 'https://mumei.dev/schemas/reviews-trend.schema.json',
    title: 'mumei reviews trend',
    description:
      'GET /api/trends/reviews?days=14 result. Daily count of review JSON files grouped by verdict.',
  },
)

export const HooksTrendSchema = Type.Array(
  Type.Object(
    {
      hook_id: Type.String({
        description:
          'Hook rule short id emitted by hooks/_lib/hook-stats.sh:mumei_hook_stats_record (e.g. S1, M1, X3, I1).',
      }),
      count: Type.Integer({ minimum: 1 }),
      decision: Type.Union(
        [
          Type.Literal('allow'),
          Type.Literal('deny'),
          Type.Literal('warn'),
          Type.Literal('block'),
          Type.Literal('noop'),
          Type.Literal('pass'),
          Type.Literal('error'),
        ],
        {
          description:
            'Most common decision recorded for the hook_id within the window. "error" surfaces internal hook failures (e.g. cwd anchor unreachable) that previously exited silently.',
        },
      ),
    },
    { additionalProperties: false },
  ),
  {
    $id: 'https://mumei.dev/schemas/hooks-trend.schema.json',
    title: 'mumei hooks trend',
    description:
      'GET /api/trends/hooks?topN=10&windowH=24 result. Top-N hook_id rows by firing count within the window.',
  },
)

export type TokensTrend = Static<typeof TokensTrendSchema>
export type ReviewsTrend = Static<typeof ReviewsTrendSchema>
export type HooksTrend = Static<typeof HooksTrendSchema>
