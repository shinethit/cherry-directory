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

  // Auto-rotate every 5 seconds if multiple announcements
  useEffect(() => {
    if (announcements.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % announcements.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [announcements.length])

  if (announcements.length === 0 || dismissed) return null

  const current = announcements[currentIndex]

  return (
    <div className="relative bg-gradient-to-r from-amber-600/20 to-amber-500/10 border-b border-amber-500/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="animate-marquee inline-block">
            <span className="text-amber-300 text-sm font-myanmar">📢 {current.content} &nbsp;&nbsp;•&nbsp;&nbsp;</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-300/50 hover:text-amber-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  )
}