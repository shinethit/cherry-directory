// One approve path for listings (v9.20, E8).
//
// AdminPage.handleApprove and EditListingPage's Admin Controls status
// select used to disagree: approving from Admin set status='approved'
// AND is_verified=true + verify_type='cherry', while approving from
// Edit set only status='approved' — the same action had two different
// outcomes depending on where it was done. Both screens now build the
// update through here, so the outcome is identical.
//
// NOTE (A5, open intent question — flagged for the user, not decided
// here): whether approval SHOULD imply Cherry verification at all.
// This helper only makes the two screens agree on the current Admin
// behaviour; it does not decide the policy.
export function buildListingStatusUpdate(newStatus) {
  if (newStatus === 'approved') {
    return { status: 'approved', is_verified: true, verify_type: 'cherry' }
  }
  return { status: newStatus }
}
