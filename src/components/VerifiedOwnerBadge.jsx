// VerifiedOwnerBadge — "Verified by Owner" gold animated badge
// Usage:
//   <VerifiedOwnerBadge />           full size
//   <VerifiedOwnerBadge small />     compact for cards

export default function VerifiedOwnerBadge({ small = false }) {
  return (
    <span className={`badge-verified-owner ${small ? 'badge-sm' : ''}`} title="ဆိုင်ရှင် မှ Verified ပြုလုပ်ပြီး">
      <span className="badge-icon">
        {/* Checkmark SVG — cleaner than lucide at tiny sizes */}
        <svg
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: small ? 8 : 10, height: small ? 8 : 10 }}
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="badge-text">
        {small ? 'Verified Owner' : 'Verified by Owner'}
      </span>
    </span>
  )
}
