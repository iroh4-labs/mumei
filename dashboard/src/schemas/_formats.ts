// FormatRegistry side-effect import. TypeBox does not validate `format`
// strings out of the box; TypeCompiler.Compile() raises "Unknown format"
// on Check() unless the format is registered. Importers source this
// module once (pure side effect) before compiling any validator that
// references a registered format. The registry is a global singleton,
// so a single import per process is sufficient.
import { FormatRegistry } from '@sinclair/typebox'

// ISO 8601 / RFC 3339 date-time. Accepts seconds-precision and any
// fractional digits, with `Z` or `±HH:MM` offset. Matches the strings
// that hooks/_lib/state.sh emits via `date -u +%Y-%m-%dT%H:%M:%SZ`.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (v) => typeof v === 'string' && ISO_DATE_TIME.test(v))
}
