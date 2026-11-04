import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, Copy, Check, X } from 'lucide-react'
import { showError } from '../lib/toast'

export default function ShareButton({ url, title = 'Share this', description = '', customUrl = '', variant = 'default' }) {
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = customUrl || url

  // One button only (B1): it opens the share sheet/modal, which holds
  // the QR code, Copy Link and native Share — no separate QR button.
  const buttonClasses = variant === 'prominent'
    ? "flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all"
    : "w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        })
      } catch (err) { console.log('Share cancelled', err) }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.warn('Copy link failed:', err)
        showError('Link ကူးမရပါ — လိပ်စာဘားမှ ကိုယ်တိုင် ကူးယူပါ')
      }
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn('Copy link failed:', err)
      showError('Link ကူးမရပါ — လိပ်စာဘားမှ ကိုယ်တိုင် ကူးယူပါ')
    }
  }

  return (
    <>
      <button
        onClick={() => setShowQR(true)}
        className={buttonClasses}
        title="မျှဝေမည်"
        aria-label="မျှဝေမည်"
      >
        <Share2 size={variant === 'prominent' ? 16 : 18} />
        {variant === 'prominent' && <span>{copied ? 'ကူးပြီးပါပြီ ✓' : 'Share'}</span>}
      </button>

      {showQR && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-[#1a0030] rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-white text-sm">မျှဝေမည် · Scan QR Code</h3>
              <button onClick={() => setShowQR(false)} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <QRCodeSVG value={shareUrl} size={200} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1 text-xs btn-primary py-2.5 rounded-full">
                <Share2 size={14} /> မျှဝေမည်
              </button>
              <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1 text-xs bg-white/10 py-2.5 rounded-full">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'ကူးပြီးပါပြီ ✓' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}