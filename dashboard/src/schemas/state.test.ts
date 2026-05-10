// @vitest-environment jsdom
//
// Explicit jsdom directive: state.test.ts intentionally exercises the
// client-side runtime path (REQ-19.10 SSE validator runs on the browser),
// so we want to verify TypeCompiler.Compile() under jsdom rather than the
// Vitest default pool environment. The shared setup.ts also assumes
// jsdom (it patches window.matchMedia), so this directive doubles as the
// setup precondition.
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { describe, expect, it } from 'vitest'

// Side-effect import: registers `date-time` format so TypeCompiler.Compile
// does not raise "Unknown format" at Check time. Production validators
// (Wave 2 dashboard/src/lib/validators.ts) will import the same module.
import './_formats.ts'
import { StateSchema } from './state.ts'

describe('StateSchema TypeCompiler smoke test', () => {
  // Verifies that TypeCompiler.Compile() works in Vitest's default test
  // environment (jsdom). REQ-19.10 SSE validator runs on the client side,
  // so client-environment compatibility is non-negotiable. If this test
  // fails on jsdom, the SSE validator path needs `// @vitest-environment node`
  // or another workaround captured in design.md Risks 2.
  const validate = TypeCompiler.Compile(StateSchema)

  it('compiles a validator that accepts a well-formed state object', () => {
    const ok = {
      id: 'REQ-19',
      slug: 'dashboard-typebox-unification',
      phase: 'implement',
      current_wave: 1,
      created_at: '2026-05-10T14:21:13Z',
      updated_at: '2026-05-10T14:49:15Z',
      approved_at: '2026-05-10T14:49:15Z',
    }
    expect(validate.Check(ok)).toBe(true)
  })

  it('rejects an object with an invalid phase enum value', () => {
    const bad = {
      id: 'REQ-19',
      slug: 'foo',
      phase: 'unknown',
      current_wave: 0,
      created_at: '2026-05-10T14:21:13Z',
      updated_at: '2026-05-10T14:21:13Z',
    }
    expect(validate.Check(bad)).toBe(false)
  })

  it('rejects an object missing a required field', () => {
    const missing = {
      id: 'REQ-19',
      slug: 'foo',
      phase: 'plan',
      // current_wave omitted
      created_at: '2026-05-10T14:21:13Z',
      updated_at: '2026-05-10T14:21:13Z',
    }
    expect(validate.Check(missing)).toBe(false)
  })

  it('rejects an object with an unknown additional property (additionalProperties: false)', () => {
    const extra = {
      id: 'REQ-19',
      slug: 'foo',
      phase: 'plan',
      current_wave: 0,
      created_at: '2026-05-10T14:21:13Z',
      updated_at: '2026-05-10T14:21:13Z',
      bogus: 'should-be-rejected',
    }
    expect(validate.Check(extra)).toBe(false)
  })
})
