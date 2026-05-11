// Client-side validators for SSE event payloads consumed by the SPA.
//
// Uses TypeBox `Value.Check` / `Value.Errors` (AST traversal) instead of
// `TypeCompiler.Compile()` so the SPA bundle does not invoke
// `new Function(...)`, which CSP forbids without `script-src
// 'unsafe-eval'`. Server hot-path validation lives in
// `server/lib/validators.ts` and stays JIT-compiled for throughput.
//
// Side-effect import '../schemas/_formats.ts' registers the
// 'date-time' format with the global FormatRegistry; without it
// `Value.Check` raises "Unknown format" when the schema includes
// `format: 'date-time'` constraints.
import type { Static, TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

import '../schemas/_formats.ts'
import { SseEventSchema } from '../schemas/sse-event.ts'

type Validator<T extends TSchema> = {
  Check: (value: unknown) => value is Static<T>
  Errors: (value: unknown) => Iterable<{ path: string; message: string; value: unknown }>
}

function makeValidator<T extends TSchema>(schema: T): Validator<T> {
  return {
    Check(value): value is Static<T> {
      return Value.Check(schema, value)
    },
    Errors(value) {
      return Value.Errors(schema, value)
    },
  }
}

export const validateSseEvent = makeValidator(SseEventSchema)
