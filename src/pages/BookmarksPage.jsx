import { useState, useEffect } from 'react'
import { Bookmark, Building2, Newspaper } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useSEO } from '../hooks/useSEO'
import { ListingCard, PostCard, EmptyState } from '../components/UI'

export default function BookmarksPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const [tab, setTab] = useState('listings')
  const [listings, setListings] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  useSEO({ title: 'Saved Bookmarks' })

  useEffect(() => {
    async function load() {
      if (!isLoggedIn || !user) { setLoading(false); return }
      setLoading(true)
      try {
        const { data: bmarks } = await supabase
          .from('bookmarks')
          .select('target_id, target_type')
          .eq('user_id', user.id)

        if (!bmarks?.length) { setListings([]); setPosts([]); setLoading(false); return }

        const listingIds = bmarks.filter(b => b.target_type === 'listing').map(b => b.target_id)
        const postIds = bmarks.filter(b => b.target_type === 'post').map(b => b.target_id)

        const [{ data: lData }, { data: pData }] = await Promise.all([
          listingIds.length
            ? supabase.from('listings').select('*, category:categories(name, name_mm, icon)').in('id', listingIds)
            : Promise.resolve({ data: [] }),
          postIds.length
            ? supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm)').in('id', postIds)
            : Promise.resolve({ data: [] }),
        ])

        setListings(lData || [])
        setPosts(pData || [])
      } catch (err) {
        console.warn('Bookmarks load error:', err)
      }
      setLoading(false)
    }
    load()
  }, [user, isLoggedIn])

  return (
    <div className="py-4">
      <div className="px-4 mb-4">
        <h1 className="font-display font-bold text-xl text-white">Saved Items</h1>
        <p className="text-xs text-white/40 mt-0.5 font-myanmar">သိမ်းဆည်းထားသောများ</p>
      </div>

      <div className="flex gap-2 px-4 mb-4">
        {[
          { id: 'listings', label: 'လုပ်ငန်းများ', icon: Building2, count: listings.length },
          { id: 'posts', label: 'သတင်းများ', icon: Newspaper, count: posts.length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${tab === id ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40' : 'bg-white/5 text-white/50 border border-white/10'}`}
          >
            <Icon size={12} /> {label} {count > 0 && <span className="bg-white/20 px-1.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-12">Loading...</p>
        ) : tab === 'listings' ? (
          listings.length === 0
            ? <EmptyState icon="🔖" title="Saved လုပ်ငန်း မရှိသေး" message="Directory မှ လုပ်ငန်းတွေကို Bookmark လုပ်ပါ" />
            : listings.map(l => <ListingCard key={l.id} listing={l} />)
        ) : (
          posts.length === 0
            ? <EmptyState icon="📰" title="Saved သတင်း မရှိသေး" message="News မှ သတင်းများကို Bookmark လုပ်ပါ" />
            : posts.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  )
}
