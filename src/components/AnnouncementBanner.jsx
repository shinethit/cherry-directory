import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) setAnnouncements(data)
      })
  }, [])

  // A5: no auto-rotate and no marquee — the text stays still so it can be
  // read to the end; the user switches between announcements with the dots.
  if (announcements.length === 0 || dismissed) return null

  const current = announcements[currentIndex]

  return (
    <div className="relative bg-gradient-to-r from-amber-600/20 to-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 text-sm font-myanmar leading-relaxed">📢 {current.content}</p>
          {announcements.length > 1 && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`ကြေညာချက် ${i + 1}`}
                  className="flex items-center justify-center min-w-[24px] min-h-[24px] p-1"
                >
                  <span
                    className={`block rounded-full transition-all ${i === currentIndex ? 'w-6 h-1.5 bg-amber-400' : 'w-1.5 h-1.5 bg-white/30'}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="ပိတ်မည်"
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-amber-300/70 hover:text-amber-300 hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
