// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import VerificationBadge from '../components/VerificationBadge'

// v9.34 (Bug 1): nearly every listing card showed the gold owner
// badge "ပိုင်ရှင် အတည်ပြု ✓" — live, 1,078 verified listings were
// cherry (1,077) vs owner (1) — because the card rendered the owner
// badge for any is_verified row and the detail page fell back to it
// for a missing/unknown verify_type too. One shared component now
// picks the badge from verify_type, so card, detail, Similar
// Businesses and My Submissions can never disagree about the same
// row. Verified rows with a missing/null/'none'/unknown type fall
// back to CHERRY (the only mass path setting is_verified=true is
// admin approval, which always sets 'cherry').

const srcDir = dirname(fileURLToPath(import.meta.url))
const readSrc = (rel) => readFileSync(join(srcDir, rel), 'utf8')

describe('v9.34 VerificationBadge mapping', () => {
  it('owner → gold owner badge only', () => {
    render(<VerificationBadge verifyType="owner" communityVotes={0} />)
    expect(screen.getByText('ပိုင်ရှင် အတည်ပြု ✓')).toBeTruthy()
    expect(screen.queryByText('Cherry အတည်ပြု ✓')).toBeNull()
    expect(screen.queryByText(/Community အတည်ပြု/)).toBeNull()
    cleanup()
  })

  it('cherry → Cherry pill, never the gold owner badge', () => {
    render(<VerificationBadge verifyType="cherry" communityVotes={0} />)
    expect(screen.getByText('Cherry အတည်ပြု ✓')).toBeTruthy()
    expect(screen.queryByText('ပိုင်ရှင် အတည်ပြု ✓')).toBeNull()
    cleanup()
  })

  it('community → blue pill with (votes) when votes > 0, no count when 0', () => {
    render(<VerificationBadge verifyType="community" communityVotes={12} />)
    expect(screen.getByText(/Community အတည်ပြု/)).toBeTruthy()
    expect(screen.getByText('(12)')).toBeTruthy()
    cleanup()
    render(<VerificationBadge verifyType="community" communityVotes={0} />)
    expect(screen.getByText(/Community အတည်ပြု/)).toBeTruthy()
    expect(screen.queryByText('(0)')).toBeNull()
    cleanup()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ["'none'", 'none'],
    ["unknown value", 'bogus'],
  ])('%s verify_type falls back to cherry, never owner', (_label, verifyType) => {
    render(<VerificationBadge verifyType={verifyType} communityVotes={0} />)
    expect(screen.getByText('Cherry အတည်ပြု ✓')).toBeTruthy()
    expect(screen.queryByText('ပိုင်ရှင် အတည်ပြု ✓')).toBeNull()
    cleanup()
  })

  it('small renders the compact pill', () => {
    render(<VerificationBadge verifyType="cherry" communityVotes={0} small />)
    expect(screen.getByText('Cherry အတည်ပြု ✓').className).toContain('text-[10px]')
    cleanup()
  })
})

describe('v9.34 card and detail agree for the same row (source guards)', () => {
  it('the card renders the shared badge from verify_type, never the owner badge', () => {
    const uiSrc = readSrc('../components/UI.jsx')
    expect(uiSrc).toContain('{listing.is_verified && <VerificationBadge verifyType={listing.verify_type} communityVotes={listing.community_votes} small />')
    expect(uiSrc).not.toContain('VerifiedOwnerBadge')
  })

  it('the detail header renders the shared badge; both bad fallbacks are gone', () => {
    const detailSrc = readSrc('./ListingDetailPage.jsx')
    expect(detailSrc).toContain('<VerificationBadge verifyType={listing.verify_type} communityVotes={listing.community_votes} />')
    // Missing-type → owner fallback (:491) and the catch-all else → owner (:504).
    expect(detailSrc).not.toContain("(!listing.verify_type && listing.is_verified)")
    // The verified-without-owner gold box is gone.
    expect(detailSrc).not.toContain('border-gold-500/25 bg-gold-500/8')
    // The owner section gated on the joined owner row is untouched.
    expect(detailSrc).toContain('listing.is_verified && listing.owner')
  })

  it('Similar Businesses + My Submissions select verify_type/community_votes and render the shared badge', () => {
    const similarSrc = readSrc('../components/SimilarBusinesses.jsx')
    expect(similarSrc).toContain('verify_type, community_votes')
    expect(similarSrc).toContain('<VerificationBadge verifyType={l.verify_type} communityVotes={l.community_votes} small />')
    expect(similarSrc).not.toContain('text-gold-400">✓')

    const mineSrc = readSrc('./MySubmissionsPage.jsx')
    expect(mineSrc).toContain('verify_type, community_votes')
    expect(mineSrc).toContain('<VerificationBadge verifyType={item.verify_type} communityVotes={item.community_votes} small />')
    expect(mineSrc).not.toContain('text-gold-400">✓')
  })
})
