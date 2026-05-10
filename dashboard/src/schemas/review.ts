import { type Static, Type } from '@sinclair/typebox'

const FindingSchema = Type.Object({
  id: Type.Optional(Type.String()),
  reviewer: Type.Optional(Type.String()),
  severity: Type.Union([
    Type.Literal('LOW'),
    Type.Literal('MEDIUM'),
    Type.Literal('HIGH'),
    Type.Literal('CRITICAL'),
  ]),
  category: Type.Optional(Type.String()),
  location: Type.Optional(Type.String()),
  message: Type.String(),
  source: Type.Optional(
    Type.String({
      description:
        "Detector ground-truth marker: 'semgrep' / 'osv-scanner' / 'structural-integrity' for deterministic findings.",
    }),
  ),
  validator: Type.Optional(
    Type.Object({
      decision: Type.Optional(
        Type.Union([
          Type.Literal('valid'),
          Type.Literal('invalid'),
          Type.Literal('unsure'),
          Type.Literal('valid_by_assertion'),
        ]),
      ),
      confidence: Type.Optional(Type.String()),
    }),
  ),
})

const ReviewerVerdictSchema = Type.Object({
  verdict: Type.Optional(
    Type.Union([
      Type.Literal('PASS'),
      Type.Literal('NEEDS_IMPROVEMENT'),
      Type.Literal('MAJOR_ISSUES'),
    ]),
  ),
})

export const ReviewSchema = Type.Object(
  {
    feature: Type.String({ description: 'REQ-N-slug or plan-vehicle bare slug.' }),
    wave: Type.Optional(
      Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('all')], {
        description: "Wave under review, or 'all' for end-of-feature pipelines.",
      }),
    ),
    iteration: Type.Integer({
      minimum: 1,
      maximum: 3,
      description:
        'Review iter (capped at 3). Iter 1 is baseline; iter 2+ uses next_iter_reviewers from iter N-1.',
    }),
    iter_head: Type.Optional(
      Type.String({
        pattern: '^[0-9a-f]{7,40}$',
        description:
          'git rev-parse HEAD at iter completion. Used by Stage 0 detector skip logic in iter N+1.',
      }),
    ),
    verdict: Type.Union([
      Type.Literal('PASS'),
      Type.Literal('NEEDS_IMPROVEMENT'),
      Type.Literal('MAJOR_ISSUES'),
    ]),
    summary: Type.String(),
    reviewers: Type.Optional(
      Type.Record(Type.String(), ReviewerVerdictSchema, {
        description:
          'Per-reviewer verdict map. Keys are reviewer short names (spec-compliance / security / adversarial).',
      }),
    ),
    findings_surfaced: Type.Optional(Type.Array(FindingSchema)),
    findings_filtered: Type.Optional(Type.Array(FindingSchema)),
    next_iter_reviewers: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Reviewer set to launch in iter N+1. Always contains 'adversarial' (REQ-7.3 invariant).",
      }),
    ),
    detector_skipped: Type.Optional(
      Type.Boolean({
        description:
          'REQ-7.5: true when iter 2+ skipped Stage 0 because no detector-relevant file changed since iter N-1.',
      }),
    ),
    detector_reused_from: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: "Path to the previous iter's detector report when detector_skipped == true.",
      }),
    ),
    detector_report: Type.Optional(
      Type.String({
        description: 'Path to <ts>-detectors.json with raw semgrep / osv-scanner findings.',
      }),
    ),
    short_circuited_from: Type.Optional(
      Type.String({
        description:
          'Path to the prior review JSON when this entry is a REQ-7.7 short-circuit synthetic record.',
      }),
    ),
  },
  {
    $id: 'https://mumei.dev/schemas/review.schema.json#v0.1.0',
    title: 'mumei review pipeline output',
    description:
      'Phase 5 / /mumei:review pipeline verdict, persisted at .mumei/specs/<feature>/reviews/<ts>.json (spec vehicle) or .mumei/plans/<slug>/reviews/<ts>.json (plan vehicle).',
  },
)

export type Review = Static<typeof ReviewSchema>
export type Finding = Static<typeof FindingSchema>
