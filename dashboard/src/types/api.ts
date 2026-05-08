// Shape of /api/features and /events responses.
// Source of truth for the underlying domain types is schemas/*.json
// at the repo root; `npm run generate-types` will regenerate
// `state.types.ts`, `review.types.ts`, etc., from those.

export type Phase = 'plan' | 'implement' | 'review' | 'done'
export type Vehicle = 'spec' | 'plan'
export type Verdict = 'PASS' | 'NEEDS_IMPROVEMENT' | 'MAJOR_ISSUES'

export interface FeatureSummary {
  feature: string // compound key e.g., REQ-14-harness-quality-improvements
  id: string // REQ-14 (or bare slug for plan vehicle)
  slug: string
  vehicle: Vehicle
  phase: Phase
  current_wave: number
  total_waves: number | null
  last_review_verdict: Verdict | null
  last_activity_at: string // ISO 8601
  ac_count: number
  task_total: number
  task_done: number
  cost_input: number
  cost_output: number
  cost_cache_read: number
  cost_cache_create: number
  cache_hit_rate: number | null // 0..1
}

export type ServerEvent =
  | { kind: 'feature.update'; feature: string; ts: string }
  | { kind: 'feature.created'; feature: string; ts: string }
  | { kind: 'feature.archived'; feature: string; ts: string }
  | { kind: 'review.added'; feature: string; ts: string; verdict: Verdict }
  | { kind: 'heartbeat'; ts: string }
