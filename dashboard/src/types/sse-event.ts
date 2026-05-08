/**
 * AUTO-GENERATED. Do not edit by hand.
 * Source: schemas/sse-event.schema.json
 * Regenerate: cd dashboard && npm run generate-types
 */

/**
 * Server-Sent Events emitted by dashboard/server/sse.ts on /api/events. All events are debounced 200ms per (event, slug). state.json updates emit BOTH feature.update and activity.added (REQ-15.15 dual-emit). Producer: backend chokidar -> EventEmitter pipeline. Consumer: dashboard/src/hooks/useEventStream.ts.
 */
export type MumeiDashboardSSEEvent = {
  type: "feature.update" | "cost.updated" | "activity.added";
  [k: string]: unknown;
} & (
  | {
      type: "feature.update";
      /**
       * Feature slug whose state.json changed; useEventStream invalidates ['features'] and ['feature', slug, 'detail'].
       */
      slug: string;
    }
  | {
      type: "cost.updated";
      /**
       * Feature slug owning the cost-log, or null when the change was project-wide.
       */
      slug?: string | null;
    }
  | {
      type: "activity.added";
      /**
       * Mirrors activity-event.schema.json. Inlined because the dashboard generator does not resolve cross-file $ref.
       */
      event:
        | {
            ts: string;
            kind: "commit";
            slug?: string | null;
            ref: string;
            message: string;
          }
        | {
            ts: string;
            kind: "review";
            slug: string;
            verdict: "PASS" | "NEEDS_IMPROVEMENT" | "MAJOR_ISSUES";
            iter: number;
          }
        | {
            ts: string;
            kind: "phase";
            slug: string;
            from: "plan" | "implement" | "review" | "done";
            to: "plan" | "implement" | "review" | "done";
          }
        | {
            ts: string;
            kind: "hook";
            rule_id: string;
            decision: "allow" | "deny" | "warn" | "block" | "noop";
          };
    }
);
