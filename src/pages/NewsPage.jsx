import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PostCard, Skeleton, EmptyState } from '../components/UI'

const TYPES = [
  { value: '', label: 'အားလုံး' },
  { value: 'news', label: '📰 သတင်း' },
  { value: 'event', label: '📅 Event' },
  { value: 'announcement', label: '📢 ကြေညာချက်' },
]

export default function NewsPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [pinned, setPinned] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: pinnedData }, { data: postsData }] = await Promise.all([
        supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').eq('is_pinned', true).limit(3),
        supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').eq('is_pinned', false).then(q => type ? q.eq('type', type) : q).then(q => q.order('created_at', { ascending: false }).limit(30)),
      ])
      setPinned(pinnedData || [])
      setPosts(postsData || [])
      setLoading(false)
    }
    load()
  }, [type])

  return (
    <div className="py-4">
      {/* Type filter pills */}
      <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-3">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${type === t.value ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pinned posts */}
      {pinned.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] text-gold-500/70 font-display font-semibold uppercase tracking-wider mb-2">📌 Pinned</p>
          <div className="space-y-3">
            {pinned.map(p => <PostCard key={p.id} post={p} />)}
          </div>
          <div className="border-t border-white/8 mt-4" />
        </div>
      )}

      {/* Posts list */}
      <div className="px-4 space-y-3">
        {loading
          ? [1,2,3,4].map(n => <Skeleton key={n} className="h-52" />)
          : posts.length === 0
          ? <EmptyState icon="📰" title="သတင်း မတွေ့ပါ" />
          : posts.map(p => <PostCard key={p.id} post={p} />)
        }
      </div>
    </div>
  )
}
