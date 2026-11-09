// VerificationBadge — ONE shared verify_type-aware badge (v9.34).
// Every place that shows a verification badge renders through here,
// so the card, the detail page, Similar Businesses and My
// Submissions can never disagree about the same row again.
//
// Props:
//   verifyType      — the row's verify_type ('owner' | 'cherry' |
//                     'community' | null | 'none' | unknown)
//   communityVotes  — shown as (n) on the community pill when > 0
//   small           — compact sizing for cards / tight rows
//
// Callers gate on is_verified already; this component only picks
// WHICH badge a verified row gets.
//
// FALLBACK (live evidence, verified 2026-11-09 via public REST):
// of 2,186 approved listings, 1,078 are verified — 1,077 cherry,
// 1 owner, 0 community, 0 verified with a null/'none' type. The
// only mass path that sets is_verified=true is admin approval,
// which always sets verify_type='cherry'. So a verified row with a
// missing, null, 'none' or unknown verify_type is a cherry
// verification — NOT an owner one (missing→owner re-created the bug
// where ~1,078 cards showed the gold owner badge while exactly 1
// listing was owner-verified) and NOT "no badge" (that would hide
// real verification).
import VerifiedOwnerBadge from './VerifiedOwnerBadge'

export default function VerificationBadge({ verifyType, communityVotes = 0, small = false }) {
  if (verifyType === 'owner') {
    return <VerifiedOwnerBadge small={small} />
  }

  if (verifyType === 'community') {
    return (
      <span className={`flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}>
        👥 Community အတည်ပြု ✓
        {communityVotes > 0 && <span className="text-blue-300/60">({communityVotes})</span>}
      </span>
    )
  }

  // 'cherry', and the fallback for null / undefined / 'none' /
  // unknown — see the evidence comment above.
  return (
    <span className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600/30 to-brand-700/30 border border-brand-400/40 ${small ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
      <span className={small ? 'text-[10px]' : 'text-sm'}>🍒</span>
      <span className={`font-semibold text-brand-300 ${small ? 'text-[10px]' : 'text-xs'}`}>Cherry အတည်ပြု ✓</span>
    </span>
  )
}
