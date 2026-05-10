import { type Static, Type } from '@sinclair/typebox'

export const StateSchema = Type.Object(
  {
    id: Type.String({
      pattern: '^(REQ-[0-9]+|[a-z0-9][a-z0-9-]*)$',
      description:
        'Spec-vehicle stable identifier (REQ-N). For plan-vehicle features this field equals slug (kebab-case).',
    }),
    slug: Type.String({
      pattern: '^[a-z0-9][a-z0-9-]*$',
      description: 'Kebab-case feature name.',
    }),
    phase: Type.Union(
      [
        Type.Literal('plan'),
        Type.Literal('implement'),
        Type.Literal('review'),
        Type.Literal('done'),
      ],
      {
        description: 'spec vehicle uses all 4 values; plan vehicle uses only implement / done.',
      },
    ),
    current_wave: Type.Integer({
      minimum: 0,
      description:
        'Wave number currently in flight. 0 before approval gate, 1+ during implement, equals last Wave during review.',
    }),
    created_at: Type.String({
      format: 'date-time',
      description: 'ISO 8601 UTC. Set on state-init, never updated.',
    }),
    updated_at: Type.String({
      format: 'date-time',
      description: 'ISO 8601 UTC. Bumped on every state mutation.',
    }),
    approved_at: Type.Optional(
      Type.String({
        format: 'date-time',
        description:
          'Set on the spec-vehicle Phase 3.5 user approval transition. Plan vehicle does not set this field.',
      }),
    ),
    last_observed_head: Type.Optional(
      Type.String({
        pattern: '^[0-9a-f]{7,40}$',
        description:
          'git rev-parse HEAD captured by hooks at the most recent transition. Used to detect external commits.',
      }),
    ),
    pending_review: Type.Optional(
      Type.Boolean({
        description:
          'Plan vehicle only. Set true by post-task-event.sh when the last TaskCompleted matches task_created_count; cleared by /mumei:review on PASS.',
      }),
    ),
    task_created_count: Type.Optional(
      Type.Integer({
        minimum: 0,
        description: 'Plan vehicle only. Counter of TaskCreated events since plan-mode capture.',
      }),
    ),
    task_completed_count: Type.Optional(
      Type.Integer({
        minimum: 0,
        description: 'Plan vehicle only. Counter of TaskCompleted events.',
      }),
    ),
    depends_on: Type.Optional(
      Type.Array(Type.String({ pattern: '^REQ-[0-9]+(-[a-z0-9-]+)?$' }), {
        description:
          'Phase D forward-compat. Cross-feature dependency list. Populated from tasks.md _DependsOn:_ meta when introduced.',
      }),
    ),
  },
  {
    $id: 'https://mumei.dev/schemas/state.schema.json',
    title: 'mumei feature state',
    description:
      'Persistent per-feature state written atomically by hooks/_lib/state.sh. Lives at .mumei/specs/<feature>/state.json (spec vehicle) or .mumei/plans/<slug>/state.json (plan vehicle).',
    additionalProperties: false,
  },
)

export type State = Static<typeof StateSchema>
