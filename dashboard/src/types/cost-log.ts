/**
 * AUTO-GENERATED. Do not edit by hand.
 * Source: schemas/cost-log.schema.json
 * Regenerate: cd dashboard && npm run generate-types
 */

/**
 * One line of .mumei/specs/<feature>/cost-log.jsonl (spec vehicle) or .mumei/plans/<slug>/cost-log.jsonl (plan vehicle). Append-only. Per-feature, archived with the feature.
 */
export interface MumeiCostLogJSONLEntry {
  /**
   * ISO 8601 UTC.
   */
  ts: string;
  feature: string;
  wave?: number | null;
  iteration?: number | null;
  /**
   * Reviewer / curator / SDK agent short name.
   */
  agent: string;
  /**
   * before: launch bookmark (no token usage). after: completion record with usage payload.
   */
  phase: "before" | "after";
  /**
   * Anthropic API canonical field. Tokens AFTER the cache breakpoint (i.e., not cached).
   */
  input_tokens?: number;
  output_tokens?: number;
  /**
   * Cache HIT (tokens served from cache). Anthropic canonical field.
   */
  cache_read_input_tokens?: number;
  /**
   * Cache MISS first-write (tokens that just landed in a new cache breakpoint). Anthropic canonical field.
   */
  cache_creation_input_tokens?: number;
}
