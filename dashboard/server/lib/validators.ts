// Compiled TypeBox validators for server hot-path runtime checks
// (request handlers, JSONL streaming aggregator, review.json reads).
// Each `TypeCompiler.Compile()` call runs at module top-level so the
// JIT-emitted validator is reused for every request / line / event
// without per-call allocation.
//
// Server-only. The client uses `src/lib/validators.ts` which avoids
// the JIT compiler so the SPA bundle does not require
// `script-src 'unsafe-eval'` in helmet's CSP.

import { TypeCompiler } from '@sinclair/typebox/compiler'

import '../../src/schemas/_formats.ts'
import { CostLogEntrySchema } from '../../src/schemas/cost-log.ts'
import { ReviewSchema } from '../../src/schemas/review.ts'
import { StateSchema } from '../../src/schemas/state.ts'

export const validateState = TypeCompiler.Compile(StateSchema)
export const validateCostLogEntry = TypeCompiler.Compile(CostLogEntrySchema)
export const validateReview = TypeCompiler.Compile(ReviewSchema)
