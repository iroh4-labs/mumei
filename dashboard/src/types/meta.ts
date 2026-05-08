/**
 * AUTO-GENERATED. Do not edit by hand.
 * Source: schemas/meta.schema.json
 * Regenerate: cd dashboard && npm run generate-types
 */

/**
 * Backend identity and aggregate counters used by the TopBar. Producer: dashboard/server/meta.ts. Consumer: dashboard/src/hooks/useMeta.ts. Two endpoints share this schema via $defs.
 */
export type MumeiDashboardMetaStats = Meta | MetaStats;

export interface Meta {
  /**
   * process.cwd() converted to '~/...' when under $HOME, else the absolute path. Computed by dashboard/server/lib/path.ts.
   */
  projectLabel: string;
}
export interface MetaStats {
  /**
   * Count of features with phase != 'done' across .mumei/specs/ and .mumei/plans/.
   */
  activeCount: number;
  /**
   * Sum of input_tokens + output_tokens for cost-log entries this calendar month (UTC).
   */
  monthTokens: number;
  /**
   * Project-wide cache_read_input_tokens / (input_tokens + cache_read_input_tokens) for the current month.
   */
  cacheHitRate: number;
  /**
   * 24-hour rolling average firing rate computed from .hook-stats.jsonl. 0 when the file is absent.
   */
  hooksPerSec: number;
  /**
   * Count of activity events (commits + reviews + hooks + phase changes) in the last 24 hours.
   */
  eventCount24h: number;
}
