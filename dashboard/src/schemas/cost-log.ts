import { type Static, Type } from '@sinclair/typebox'

export const CostLogEntrySchema = Type.Object(
  {
    ts: Type.String({ format: 'date-time', description: 'ISO 8601 UTC.' }),
    feature: Type.String(),
    wave: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    iteration: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    agent: Type.String({ description: 'Reviewer / curator / SDK agent short name.' }),
    phase: Type.Union([Type.Literal('before'), Type.Literal('after')], {
      description:
        'before: launch bookmark (no token usage). after: completion record with usage payload.',
    }),
    input_tokens: Type.Optional(
      Type.Integer({
        minimum: 0,
        description:
          'Anthropic API canonical field. Tokens AFTER the cache breakpoint (i.e., not cached).',
      }),
    ),
    output_tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cache_read_input_tokens: Type.Optional(
      Type.Integer({
        minimum: 0,
        description: 'Cache HIT (tokens served from cache). Anthropic canonical field.',
      }),
    ),
    cache_creation_input_tokens: Type.Optional(
      Type.Integer({
        minimum: 0,
        description:
          'Cache MISS first-write (tokens that just landed in a new cache breakpoint). Anthropic canonical field.',
      }),
    ),
  },
  {
    $id: 'https://mumei.dev/schemas/cost-log.schema.json#v0.1.0',
    title: 'mumei cost-log JSONL entry',
    description:
      'One line of .mumei/specs/<feature>/cost-log.jsonl (spec vehicle) or .mumei/plans/<slug>/cost-log.jsonl (plan vehicle). Append-only. Per-feature, archived with the feature.',
    additionalProperties: false,
  },
)

export type CostLogEntry = Static<typeof CostLogEntrySchema>
