import { type Static, Type } from '@sinclair/typebox'

import './_formats.ts'

export const ReliabilityLogEntrySchema = Type.Object(
  {
    feature: Type.String({
      minLength: 1,
      description:
        'feature_dir_key — REQ-N-<slug> for spec vehicle, bare <slug> for plan vehicle. Equal to .mumei/current at append time.',
    }),
    wave: Type.String({
      description:
        'tasks.md Wave number ("1" / "2" / ...). Empty string "" for plan vehicle (no Wave concept).',
    }),
    task_id: Type.String({
      minLength: 1,
      description:
        'tasks.md task ID ("1.2" / "2.3"). For plan vehicle, the TaskCreate task index ("1" / "2" / ...).',
    }),
    trial_n: Type.Integer({
      minimum: 1,
      description:
        'Prior trial count for same (feature, wave, task_id) tuple, plus one (1-origin).',
    }),
    pass: Type.Boolean({
      description: 'True when the latest verify-log.jsonl row for the same task shows pass.',
    }),
    ts: Type.String({
      format: 'date-time',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$',
      description: 'UTC timestamp at append time, ISO 8601 with literal Z suffix.',
    }),
  },
  {
    $id: 'ReliabilityLogEntry',
    title: 'mumei reliability log entry',
    description:
      'One append-only line in .mumei/specs|plans/<feature>/reliability-log.jsonl. Produced by hooks/post-task-event.sh on TaskCompleted; consumed by /mumei:assure, /mumei:present, and the dashboard reliability tab.',
    additionalProperties: false,
  },
)

export type ReliabilityLogEntry = Static<typeof ReliabilityLogEntrySchema>

export const ReliabilityFeatureRowSchema = Type.Object(
  {
    feature: Type.String({ minLength: 1 }),
    vehicle: Type.Union([Type.Literal('spec'), Type.Literal('plan'), Type.Literal('archive')]),
    n_trials: Type.Integer({ minimum: 0 }),
    k: Type.Integer({ minimum: 1 }),
    window: Type.Integer({ minimum: 1 }),
    pass_rate: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Literal('N/A')]),
    evaluable: Type.Boolean(),
    last_updated: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    recent: Type.Array(ReliabilityLogEntrySchema),
    error: Type.Optional(Type.String()),
  },
  {
    title: 'mumei reliability feature row',
    description:
      'Per-feature aggregate row returned by GET /api/reliability. Carries pass^k summary + recent <window> trials for sparkline rendering. The `error` field is set when the JSONL file fails to parse (REQ-25.4.2 per-feature error row).',
    additionalProperties: false,
  },
)

export type ReliabilityFeatureRow = Static<typeof ReliabilityFeatureRowSchema>

export const ReliabilityResponseSchema = Type.Object(
  {
    features: Type.Array(ReliabilityFeatureRowSchema),
  },
  {
    title: 'mumei reliability response',
    description:
      'Response shape for GET /api/reliability. The `features` array sorts most-recent-updated first; rows with no log appear at the bottom.',
    additionalProperties: false,
  },
)

export type ReliabilityResponse = Static<typeof ReliabilityResponseSchema>
