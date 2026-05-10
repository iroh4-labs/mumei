// Compiled TypeBox validators for runtime shape checks at the system
// boundaries (bash -> Node state.json, JSONL aggregator lines, review
// JSON, SSE event payload). Each `TypeCompiler.Compile()` call is
// performed at module top-level so the JIT-emitted validator is reused
// for every request / line / event without per-call allocation.
//
// Side-effect import '../schemas/_formats.ts' registers the
// 'date-time' format with the global FormatRegistry; without it
// TypeCompiler.Compile() raises "Unknown format" on Check() time.
import '../schemas/_formats.ts'

import { TypeCompiler } from '@sinclair/typebox/compiler'

import { ActivityEventSchema } from '../schemas/activity-event.ts'
import { CostLogEntrySchema } from '../schemas/cost-log.ts'
import { ReviewSchema } from '../schemas/review.ts'
import { SseEventSchema } from '../schemas/sse-event.ts'
import { StateSchema } from '../schemas/state.ts'

export const validateState = TypeCompiler.Compile(StateSchema)
export const validateCostLogEntry = TypeCompiler.Compile(CostLogEntrySchema)
export const validateReview = TypeCompiler.Compile(ReviewSchema)
export const validateSseEvent = TypeCompiler.Compile(SseEventSchema)
export const validateActivityEvent = TypeCompiler.Compile(ActivityEventSchema)
