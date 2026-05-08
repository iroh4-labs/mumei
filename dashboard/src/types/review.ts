/**
 * AUTO-GENERATED. Do not edit by hand.
 * Source: schemas/review.schema.json
 * Regenerate: cd dashboard && npm run generate-types
 */

/**
 * Phase 5 / /mumei:review pipeline verdict, persisted at .mumei/specs/<feature>/reviews/<ts>.json (spec vehicle) or .mumei/plans/<slug>/reviews/<ts>.json (plan vehicle).
 */
export interface MumeiReviewPipelineOutput {
  /**
   * REQ-N-slug or plan-vehicle bare slug.
   */
  feature: string;
  /**
   * Wave under review, or 'all' for end-of-feature pipelines.
   */
  wave?: number | "all";
  /**
   * Review iter (capped at 3). Iter 1 is baseline; iter 2+ uses next_iter_reviewers from iter N-1.
   */
  iteration: number;
  /**
   * git rev-parse HEAD at iter completion. Used by Stage 0 detector skip logic in iter N+1.
   */
  iter_head?: string;
  verdict: "PASS" | "NEEDS_IMPROVEMENT" | "MAJOR_ISSUES";
  summary: string;
  /**
   * Per-reviewer verdict map. Keys are reviewer short names (spec-compliance / security / adversarial).
   */
  reviewers?: {
    [k: string]: {
      verdict?: "PASS" | "NEEDS_IMPROVEMENT" | "MAJOR_ISSUES";
      [k: string]: unknown;
    };
  };
  findings_surfaced?: Finding[];
  findings_filtered?: Finding[];
  /**
   * Reviewer set to launch in iter N+1. Always contains 'adversarial' (REQ-7.3 invariant).
   */
  next_iter_reviewers?: string[];
  /**
   * REQ-7.5: true when iter 2+ skipped Stage 0 because no detector-relevant file changed since iter N-1.
   */
  detector_skipped?: boolean;
  /**
   * Path to the previous iter's detector report when detector_skipped == true.
   */
  detector_reused_from?: string | null;
  /**
   * Path to <ts>-detectors.json with raw semgrep / osv-scanner findings.
   */
  detector_report?: string;
  /**
   * Path to the prior review JSON when this entry is a REQ-7.7 short-circuit synthetic record.
   */
  short_circuited_from?: string;
  [k: string]: unknown;
}
export interface Finding {
  id?: string;
  reviewer?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category?: string;
  location?: string;
  message: string;
  /**
   * Detector ground-truth marker: 'semgrep' / 'osv-scanner' / 'structural-integrity' for deterministic findings.
   */
  source?: string;
  validator?: {
    decision?: "valid" | "invalid" | "unsure" | "valid_by_assertion";
    confidence?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
