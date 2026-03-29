import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, Copy, Check, X } from 'lucide-react'

export default function ShareButton({ url, title = 'Share this', description = '', customUrl = '', variant = 'default' }) {
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = customUrl || url

  const buttonClasses = variant === 'prominent'
    ? "flex items-center gap-1 text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all"
    : "flex items-center gap-1 text-xs bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"

  const qrButtonClasses = variant === 'prominent'
    ? "flex items-center gap-1 text-sm font-semibold bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full hover:bg-white/30 transition-all"
    : "flex items-center gap-1 text-xs bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"

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
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className={buttonClasses}
        >
          <Share2 size={variant === 'prominent' ? 16 : 14} />
          {copied ? 'Link copied!' : 'Share'}
        </button>
        <button
          onClick={() => setShowQR(!showQR)}
          className={qrButtonClasses}
        >
          QR Code
        </button>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-[#140020] rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-white text-sm">Scan QR Code</h3>
              <button onClick={() => setShowQR(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <QRCodeSVG value={shareUrl} size={200} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1 text-xs bg-brand-600 py-2 rounded-full">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}