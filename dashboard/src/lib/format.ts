/**
 * Format token counts compactly: 4_240_000 → "4.2M", 372_000 → "372k",
 * 91_300 → "91.3k". Returns "—" for nullish input so callers can pipe
 * raw API responses without pre-checking.
 */
export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 100_000) return `${Math.round(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

/**
 * Relative-time formatter for last-activity timestamps. Kept for
 * places that explicitly want the "Xm/Xh/Xd ago" shape.
 */
export function relTime(min: number): string {
  if (min < 60) return `${min}m ago`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ago`
  return `${Math.floor(min / 60 / 24)}d ago`
}

/**
 * Render `lastActivityMin` as a local date so feature cards show "when
 * this spec was last touched" at a glance. Returns YYYY-MM-DD (today's
 * local date for the most recent activity).
 */
export function lastActivityDate(min: number): string {
  const d = new Date(Date.now() - min * 60_000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const TRUNCATE_AT = 60

/**
 * Compact long single-line strings to at most 60 characters with an
 * ellipsis. Used in feature card / activity feed / wave headings where
 * goals and commit subjects can exceed the row width.
 */
export function truncate60(s: string): string {
  return s.length > TRUNCATE_AT ? `${s.slice(0, TRUNCATE_AT - 1)}…` : s
}
