/**
 * AUTO-GENERATED. Do not edit by hand.
 * Source: schemas/state.schema.json
 * Regenerate: cd dashboard && npm run generate-types
 */

/**
 * Persistent per-feature state written atomically by hooks/_lib/state.sh. Lives at .mumei/specs/<feature>/state.json (spec vehicle) or .mumei/plans/<slug>/state.json (plan vehicle).
 */
export interface MumeiFeatureState {
  /**
   * Spec-vehicle stable identifier. For plan-vehicle features this field equals slug.
   */
  id: string;
  /**
   * Kebab-case feature name.
   */
  slug: string;
  /**
   * spec vehicle uses all 4 values; plan vehicle uses only implement / done.
   */
  phase: "plan" | "implement" | "review" | "done";
  /**
   * Wave number currently in flight. 0 before approval gate, 1+ during implement, equals last Wave during review.
   */
  current_wave: number;
  /**
   * ISO 8601 UTC. Set on state-init, never updated.
   */
  created_at: string;
  /**
   * ISO 8601 UTC. Bumped on every state mutation.
   */
  updated_at: string;
  /**
   * Set on the spec-vehicle Phase 3.5 user approval transition. Plan vehicle does not set this field.
   */
  approved_at?: string;
  /**
   * git rev-parse HEAD captured by hooks at the most recent transition. Used to detect external commits.
   */
  last_observed_head?: string;
  /**
   * Plan vehicle only. Set true by post-task-event.sh when the last TaskCompleted matches task_created_count; cleared by /mumei:review on PASS.
   */
  pending_review?: boolean;
  /**
   * Plan vehicle only. Counter of TaskCreated events since plan-mode capture.
   */
  task_created_count?: number;
  /**
   * Plan vehicle only. Counter of TaskCompleted events.
   */
  task_completed_count?: number;
  /**
   * Phase D forward-compat. Cross-feature dependency list. Populated from tasks.md _DependsOn:_ meta when introduced.
   */
  depends_on?: string[];
}
