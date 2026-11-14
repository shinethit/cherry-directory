import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.41 FIX 2 — the submit form no longer shows the browser's native
// English validation bubble ("Please select an item in the list").
// The form carries noValidate, so the app's own validation runs
// (inline Burmese error + smooth scroll to the missing field).
// Static source assertions (same pattern as the 9.25 source checks):
// rendering the whole submit page here would duplicate the
// SubmitListingPage940 harness for one attribute.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) —
// the only node:path use is locating SubmitListingPage.jsx, read with
// readFileSync, never compared as paths — so the 9.19/9.25
// backslash-path rule does not apply here.

describe('v9.41 FIX 2 — submit form carries noValidate', () => {
  it('the submit-listing form has noValidate, and the B2 missing-fields hint is untouched', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'SubmitListingPage.jsx'),
      'utf8'
    )
    expect(src).toContain('<form id="submit-listing-form" onSubmit={handleSubmit} noValidate')
    // B2 (by design): the reason is shown so the user always knows
    // what is missing — the red hint must still be there.
    expect(src).toContain('အမည် နှင့် အမျိုးအစား လိုအပ်သည်')
  })
})
