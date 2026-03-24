import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Eye, Building2, Newspaper, Users, MessageCircle, BarChart2, Flag, ShieldCheck, Upload, ScrollText, Radio, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import AnalyticsChart from '../components/AnalyticsChart'
import VerifiedOwnerBadge from '../components/VerifiedOwnerBadge'
import { useSEO } from '../hooks/useSEO'
import { timeAgo } from '../hooks/usePresence'

const TABS = [
  { id: 'analytics', label: 'Analytics',  icon: BarChart2    },
  { id: 'live',      label: 'Live Users', icon: Radio        },
  { id: 'listings',  label: 'Listings',   icon: Building2, showBadge: 'pending' },
  { id: 'claims',    label: 'Claims',     icon: Flag,      showBadge: 'claims'  },
  { id: 'posts',     label: 'Posts',      icon: Newspaper    },
  { id: 'users',     label: 'Users',      icon: Users        },
  { id: 'chat',      label: 'Chat',       icon: MessageCircle},
  { id: 'audit',     label: 'Audit Log',  icon: ScrollText   },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin, user } = useAuth()
  useSEO({ title: 'Admin Panel' })
  const [tab, setTab]       = useState('analytics')
  const [data, setData]     = useState([])
  const [stats, setStats]   = useState({})
  const [chartData, setChartData] = useState({ listings: [], posts: [], users: [] })
  const [loading, setLoading]     = useState(true)
  const [liveUsers, setLiveUsers] = useState([])
  const [listingFilter, setListingFilter] = useState('pending')
  const liveChannelRef = useRef(null)

  useEffect(() => { loadStats() }, [])
  useEffect(() => { loadTab() }, [tab, listingFilter])

  // Live users realtime — always subscribed when admin panel is open
  useEffect(() => {
    async function fetchLive() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, avatar_url, role, last_seen, is_online')
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(50)
      setLiveUsers(data || [])
    }
    fetchLive()

    liveChannelRef.current = supabase
      .channel('admin-live-presence')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
      }, () => fetchLive())
      .subscribe()

    return () => {
      if (liveChannelRef.current) supabase.removeChannel(liveChannelRef.current)
    }
  }, [])

  async function loadStats() {
    const [{ count: listings }, { count: posts }, { count: users }, { count: pending }, { count: claims }] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('listing_claims').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setStats({ listings, posts, users, pending, claims })

    // Build chart data: listings by day (last 14 days)
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i))
      return d.toISOString().split('T')[0]
    })

    const { data: recentListings } = await supabase.from('listings').select('created_at').gte('created_at', days[0])
    const { data: recentPosts } = await supabase.from('posts').select('created_at').gte('created_at', days[0])
    const { data: recentUsers } = await supabase.from('profiles').select('created_at').gte('created_at', days[0])

    function countByDay(rows) {
      return days.map(day => ({
        label: day.slice(5), // MM-DD
        value: (rows || []).filter(r => r.created_at?.startsWith(day)).length,
      }))
    }

    setChartData({
      listings: countByDay(recentListings),
      posts: countByDay(recentPosts),
      users: countByDay(recentUsers),
    })
  }

  async function loadTab() {
    setLoading(true)
    if (tab === 'analytics' || tab === 'live') { setLoading(false); return }
    if (tab === 'listings') {
      let query = supabase.from('listings').select('*, category:categories(name, name_mm), submitter:profiles!submitted_by(full_name)').order('created_at', { ascending: false }).limit(100)
      if (listingFilter !== 'all') query = query.eq('status', listingFilter)
      const { data } = await query
      setData(data || [])
    } else if (tab === 'claims') {
      const { data } = await supabase.from('listing_claims').select('*, listing_id, listing:listings(name, name_mm), claimant:profiles(full_name)').order('created_at', { ascending: false }).limit(50)
      setData(data || [])
    } else if (tab === 'posts') {
      const { data } = await supabase.from('posts').select('*, author:profiles(full_name)').order('created_at', { ascending: false }).limit(50)
      setData(data || [])
    } else if (tab === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, avatar_url, role, points, total_reviews, total_listings, last_seen, is_online, joined_at, created_at')
        .order('last_seen', { ascending: false, nullsFirst: false })
        .limit(100)
      setData(data || [])
    } else if (tab === 'chat') {
      const { data } = await supabase.from('chat_messages').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(100)
      setData(data || [])
    } else if (tab === 'audit') {
      const { data } = await supabase.from('audit_logs').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(100)
      setData(data || [])
    }
    setLoading(false)
  }

  async function approveListing(id) { await supabase.from('listings').update({ status: 'approved' }).eq('id', id); loadTab(); loadStats() }
  async function rejectListing(id) { await supabase.from('listings').update({ status: 'rejected' }).eq('id', id); loadTab() }
  async function featureListing(id, cur) { await supabase.from('listings').update({ is_featured: !cur }).eq('id', id); loadTab() }
  async function publishPost(id, cur) { await supabase.from('posts').update({ status: cur === 'published' ? 'draft' : 'published' }).eq('id', id); loadTab() }
  async function pinPost(id, cur) { await supabase.from('posts').update({ is_pinned: !cur }).eq('id', id); loadTab() }
  async function setUserRole(id, role) { await supabase.from('profiles').update({ role }).eq('id', id); loadTab() }
  async function deleteMessage(id) { await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', id); loadTab() }

  async function approveClaim(claim) {
    await Promise.all([
      supabase.from('listing_claims').update({ status: 'approved' }).eq('id', claim.id),
      supabase.from('listings').update({ owner_id: claim.user_id, is_verified: true }).eq('id', claim.listing_id),
    ])
    loadTab(); loadStats()
  }
  async function rejectClaim(id) { await supabase.from('listing_claims').update({ status: 'rejected' }).eq('id', id); loadTab() }

  const statusBadge = { pending: 'bg-amber-500/20 text-amber-400', approved: 'bg-green-500/20 text-green-400', rejected: 'bg-red-500/20 text-red-400', published: 'bg-green-500/20 text-green-400', draft: 'bg-white/10 text-white/50' }

  return (
    <div className="pb-8">
      {/* Header — stacks on narrow screens */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0"><ArrowLeft size={18} className="text-white" /></button>
          <h1 className="font-display font-bold text-lg text-white">Admin Panel</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/categories')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 border border-white/12 text-white/60 text-xs font-display font-semibold"
          >
            📂 Categories
          </button>
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 border border-white/12 text-white/60 text-xs font-display font-semibold"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => navigate('/bulk-import')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600/20 border border-brand-400/30 text-brand-300 text-xs font-display font-semibold"
          >
            <Upload size={13} /> Import
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        {[
          { label: 'Approved', value: stats.listings || 0, color: 'text-brand-300' },
          { label: 'Pending', value: stats.pending || 0, color: 'text-amber-400' },
          { label: 'Claims', value: stats.claims || 0, color: 'text-orange-400' },
          { label: 'Posts', value: stats.posts || 0, color: 'text-green-400' },
          { label: 'Users', value: stats.users || 0, color: 'text-blue-400' },
          { label: 'Today', value: new Date().toLocaleDateString('en', { day: '2-digit', month: 'short' }), color: 'text-gold-400' },
        ].map(s => (
          <div key={s.label} className="card-dark p-3 rounded-2xl text-center">
            <p className={`font-display font-bold text-xl ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab selector — dropdown on mobile to prevent overflow */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={tab}
            onChange={e => setTab(e.target.value)}
            className="w-full appearance-none bg-brand-600/20 border border-brand-400/30 text-brand-200 text-sm font-display font-semibold rounded-xl px-4 py-2.5 pr-10 outline-none"
          >
            {TABS.map(({ id, label, showBadge }) => (
              <option key={id} value={id}>
                {label}
                {showBadge && stats[showBadge] > 0 ? ` (${stats[showBadge]})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-300 pointer-events-none" />
        </div>
      </div>

      <div className="px-4">
        {/* Analytics tab */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="card-dark p-4 rounded-2xl">
              <p className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider mb-3">New Listings (14 days)</p>
              <AnalyticsChart data={chartData.listings} label="Listings" color="#a200e6" />
            </div>
            <div className="card-dark p-4 rounded-2xl">
              <p className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider mb-3">New Posts (14 days)</p>
              <AnalyticsChart data={chartData.posts} label="Posts" color="#22c55e" />
            </div>
            <div className="card-dark p-4 rounded-2xl">
              <p className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider mb-3">New Users (14 days)</p>
              <AnalyticsChart data={chartData.users} label="Users" color="#38bdf8" />
            </div>
          </div>
        )}

        {/* Live Users tab */}
        {tab === 'live' && (
          <div className="space-y-3">
            {/* Live stats bar */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card-dark rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="font-display font-bold text-xl text-green-400">{liveUsers.length}</p>
                </div>
                <p className="text-[9px] text-white/40">Online now</p>
              </div>
              <div className="card-dark rounded-2xl p-3 text-center">
                <p className="font-display font-bold text-xl text-white">{stats.users || 0}</p>
                <p className="text-[9px] text-white/40">Total users</p>
              </div>
              <div className="card-dark rounded-2xl p-3 text-center">
                <p className="font-display font-bold text-xl text-white/50">
                  {stats.users > 0 ? Math.round(liveUsers.length / stats.users * 100) : 0}%
                </p>
                <p className="text-[9px] text-white/40">Active rate</p>
              </div>
            </div>

            {/* Live user list */}
            {liveUsers.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Radio size={36} className="text-white/15 mb-3" />
                <p className="text-white/40 font-display font-semibold">No users online</p>
              </div>
            ) : (
              liveUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 card-dark rounded-2xl">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-700 border border-brand-500/30 flex items-center justify-center overflow-hidden">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="font-bold text-white text-sm">{(u.nickname || u.full_name || '?')[0]}</span>
                      }
                    </div>
                    {/* Green dot — always shown since filtered by is_online=true */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0d0015]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-display font-semibold text-white truncate">
                        {u.nickname ? `@${u.nickname}` : u.full_name || 'User'}
                      </p>
                      {u.role !== 'member' && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                          u.role === 'admin' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                          : 'bg-brand-600/20 text-brand-300 border-brand-400/20'
                        }`}>{u.role}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-green-400 mt-0.5">
                      ● Online • {u.last_seen ? timeAgo(u.last_seen) : 'just now'}
                    </p>
                  </div>
                </div>
              ))
            )}

            <p className="text-[9px] text-white/20 text-center mt-2">
              Realtime • Auto-updates when users come online or go offline
            </p>
          </div>
        )}
        {tab === 'listings' && (
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[['pending','⏳ Pending'],['approved','✅ Approved'],['rejected','❌ Rejected'],['all','📋 All']].map(([val, label]) => (
              <button key={val} onClick={() => setListingFilter(val)}
                className={`py-1.5 rounded-xl text-[10px] font-display font-semibold border transition-colors truncate ${
                  listingFilter === val
                    ? val === 'pending'  ? 'bg-amber-500/25 border-amber-500/40 text-amber-300'
                    : val === 'approved' ? 'bg-green-500/20 border-green-500/35 text-green-300'
                    : val === 'rejected' ? 'bg-red-500/20 border-red-500/35 text-red-300'
                    : 'bg-brand-600/25 border-brand-400/40 text-brand-200'
                    : 'bg-white/5 border-white/10 text-white/40'
                `}>
                {val === 'pending' && stats.pending > 0 ? `⏳ (${stats.pending})` : label}
              </button>
            ))}
          </div>
        )}
        {tab === 'listings' && !loading && (
          <div className="space-y-2">
            {data.length === 0 && <p className="text-white/40 text-sm text-center py-8">Listing မရှိပါ</p>}
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-display font-semibold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-white/40">{item.category?.name_mm} • {item.city} • by {item.submitter?.full_name}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusBadge[item.status] || ''}`}>{item.status}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.status === 'pending' && <>
                    <button onClick={() => approveListing(item.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-xl text-xs text-green-400 hover:bg-green-500/30"><Check size={12} /> Approve</button>
                    <button onClick={() => rejectListing(item.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl text-xs text-red-400"><X size={12} /> Reject</button>
                  </>}
                  {item.status === 'approved' && (
                    <button onClick={() => featureListing(item.id, item.is_featured)} className={`px-3 py-1.5 rounded-xl text-xs border ${item.is_featured ? 'bg-gold-500/20 border-gold-500/30 text-gold-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
                      ⭐ {item.is_featured ? 'Unfeature' : 'Feature'}
                    </button>
                  )}
                  {/* Cherry Directory Verify — Admin/Mod can set verify_type = 'cherry' */}
                  {item.status === 'approved' && (
                    <button
                      onClick={async () => {
                        const isCherry = item.verify_type === 'cherry'
                        await supabase.from('listings').update({
                          verify_type: isCherry ? 'none' : 'cherry',
                          is_verified: !isCherry,
                        }).eq('id', item.id)
                        loadTab()
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                        item.verify_type === 'cherry'
                          ? 'bg-brand-600/30 border-brand-400/50 text-brand-300'
                          : 'bg-white/5 border-white/10 text-white/40 hover:border-brand-400/30 hover:text-brand-300'
                      }`}
                    >
                      🍒 {item.verify_type === 'cherry' ? 'Cherry Verified ✓' : 'Cherry Verify'}
                    </button>
                  )}
                  <button onClick={() => navigate(`/directory/${item.id}`)} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white/50"><Eye size={12} /> View</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Claims tab */}
        {tab === 'claims' && !loading && (
          <div className="space-y-2">
            {data.length === 0 && <p className="text-white/40 text-sm text-center py-8">Claim မရှိပါ</p>}
            {data.map(item => (
              <div key={item.id} className={`card-dark p-4 rounded-2xl space-y-3 ${item.status === 'approved' ? 'border border-gold-500/25' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-semibold text-white">{item.listing?.name_mm || item.listing?.name}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">by {item.claimant?.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/40">📞 {item.contact_phone}</span>
                    </div>
                    {item.note && <p className="text-xs text-white/40 mt-1 font-myanmar bg-white/5 rounded-lg px-2 py-1">{item.note}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`badge ${statusBadge[item.status] || ''}`}>{item.status}</span>
                    {item.status === 'approved' && <VerifiedOwnerBadge small />}
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (confirm(`"${item.listing?.name}" ဆိုင်ကို ${item.claimant?.full_name} မှ Claim ကို Approve ပြုလုပ်မည်။\n\n• ဆိုင်တွင် "Verified by Owner" badge ပေါ်မည်\n• ဆိုင်ရှင် info ပြင်ဆင်နိုင်မည်\n\nဆက်မည်လား?`)) {
                          approveClaim(item)
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-gold-600/30 to-gold-500/20 border border-gold-500/40 rounded-xl text-xs text-gold-400 hover:from-gold-600/40 hover:to-gold-500/30 transition-all font-semibold"
                    >
                      <ShieldCheck size={13} /> Approve
                    </button>
                    <button onClick={() => rejectClaim(item.id)} className="flex items-center gap-1 px-3 py-2 bg-red-500/15 border border-red-500/25 rounded-xl text-xs text-red-400 hover:bg-red-500/25 transition-colors">
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
                {item.status === 'approved' && (
                  <div className="flex items-center gap-2 text-xs text-white/30 flex-wrap">
                    <ShieldCheck size={12} className="text-gold-500 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate">Verified by Owner badge တပ်ဆင်ပြီး</span>
                    <button onClick={() => navigate(`/directory/${item.listing_id}`)} className="ml-auto text-brand-400 hover:text-brand-300 flex items-center gap-1 flex-shrink-0">
                      <Eye size={11} /> View
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Posts tab */}
        {tab === 'posts' && !loading && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-display font-semibold text-white line-clamp-1">{item.title_mm || item.title}</p>
                    <p className="text-[10px] text-white/40">{item.type} • {item.author?.full_name}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusBadge[item.status] || ''}`}>{item.status}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => publishPost(item.id, item.status)} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs border ${item.status === 'published' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-green-500/20 border-green-500/30 text-green-400'}`}>
                    {item.status === 'published' ? 'Unpublish' : <><Check size={12} /> Publish</>}
                  </button>
                  <button onClick={() => pinPost(item.id, item.is_pinned)} className={`px-3 py-1.5 rounded-xl text-xs border ${item.is_pinned ? 'bg-gold-500/20 border-gold-500/30 text-gold-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
                    📌 {item.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && !loading && (
          <div className="space-y-2">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="card-dark rounded-xl p-3 text-center">
                <p className="font-display font-bold text-lg text-green-400">
                  {data.filter(u => u.is_online).length}
                </p>
                <p className="text-[9px] text-white/40">Online now</p>
              </div>
              <div className="card-dark rounded-xl p-3 text-center">
                <p className="font-display font-bold text-lg text-blue-400">
                  {data.filter(u => {
                    const d = new Date(u.last_seen || u.created_at)
                    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
                  }).length}
                </p>
                <p className="text-[9px] text-white/40">Active 7d</p>
              </div>
              <div className="card-dark rounded-xl p-3 text-center">
                <p className="font-display font-bold text-lg text-white">{data.length}</p>
                <p className="text-[9px] text-white/40">Total users</p>
              </div>
            </div>

            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                <div className="flex items-start gap-3">
                  {/* Avatar + online dot */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-sm font-bold text-white overflow-hidden">
                      {item.avatar_url
                        ? <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (item.full_name?.[0] || '?')}
                    </div>
                    {item.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0d0015]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-display font-semibold text-white truncate">
                        {item.full_name || 'No name'}
                      </p>
                      {item.nickname && (
                        <span className="text-[9px] text-brand-300 font-mono">@{item.nickname}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                        item.role === 'super_admin' ? 'bg-gold-500/20 text-gold-400 border-gold-500/30'
                        : item.role === 'admin'     ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                        : item.role === 'moderator' ? 'bg-brand-600/20 text-brand-300 border-brand-400/20'
                        : 'bg-white/8 text-white/40 border-white/10'
                      }`}>{item.role === 'super_admin' ? '⭐ ' : ''}{item.role}</span>
                      <span className="text-[9px] text-white/30">
                        {item.is_online ? '🟢 Online' : item.last_seen
                          ? `Last: ${new Date(item.last_seen).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Role selector — rules:
                      super_admin: can assign any role including admin/super_admin
                      admin: can only assign member/moderator (not admin/super_admin)
                  */}
                  {isAdmin && item.role !== 'super_admin' && (
                    <select
                      value={item.role}
                      onChange={e => setUserRole(item.id, e.target.value)}
                      className="text-xs bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-white outline-none flex-shrink-0 max-w-[120px]"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      {/* Only super_admin can assign admin or super_admin */}
                      {isSuperAdmin && <option value="admin">Admin</option>}
                      {isSuperAdmin && <option value="super_admin">⭐ Super Admin</option>}
                      {/* Regular admin sees current role if it's admin (read-only display) */}
                      {!isSuperAdmin && item.role === 'admin' && <option value="admin" disabled>Admin (read-only)</option>}
                    </select>
                  )}
                  {/* Super Admin badge — not editable by anyone except another super_admin */}
                  {item.role === 'super_admin' && !isSuperAdmin && (
                    <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30 flex-shrink-0">
                      ⭐ Super Admin
                    </span>
                  )}
                </div>

                {/* Activity stats */}
                <div className="flex gap-3 border-t border-white/6 pt-2">
                  <div className="text-center">
                    <p className="text-xs font-bold text-gold-400">{(item.points || 0).toLocaleString()}</p>
                    <p className="text-[8px] text-white/30">pts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-white/70">{item.total_reviews || 0}</p>
                    <p className="text-[8px] text-white/30">reviews</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-white/70">{item.total_listings || 0}</p>
                    <p className="text-[8px] text-white/30">listings</p>
                  </div>
                  <div className="text-center ml-auto">
                    <p className="text-[8px] text-white/25">Joined</p>
                    <p className="text-[9px] text-white/40">
                      {new Date(item.joined_at || item.created_at).toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat tab */}
        {tab === 'chat' && !loading && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className={`card-dark p-3 rounded-xl flex items-start justify-between gap-2 ${item.is_deleted ? 'opacity-40' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-brand-300 mb-0.5 truncate">{item.user?.full_name || item.guest_name || 'Guest'}</p>
                  <p className="text-xs text-white/70 font-myanmar line-clamp-2">{item.content}</p>
                </div>
                {!item.is_deleted && (
                  <button onClick={() => deleteMessage(item.id)} className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-red-500/15 rounded-lg text-red-400">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && !loading && (
          <div className="space-y-2">
            {data.length === 0 && <p className="text-white/40 text-sm text-center py-8">Log မရှိသေးပါ</p>}
            {data.map(item => {
              const actionColor = {
                create: 'text-green-400 bg-green-500/15 border-green-500/20',
                update: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
                delete: 'text-red-400 bg-red-500/15 border-red-500/20',
                approve: 'text-gold-400 bg-gold-500/15 border-gold-500/20',
                reject: 'text-red-400 bg-red-500/15 border-red-500/20',
                bulk_import: 'text-purple-400 bg-purple-500/15 border-purple-500/20',
              }[item.action] || 'text-white/50 bg-white/5 border-white/10'

              const changedFields = item.changes ? Object.keys(item.changes).filter(k => !k.startsWith('_')) : []

              return (
                <div key={item.id} className="card-dark p-4 rounded-2xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      <span className={`badge border text-[9px] font-bold flex-shrink-0 ${actionColor}`}>{item.action}</span>
                      <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded font-mono flex-shrink-0">{item.target_table}</span>
                      {item.target_name && <span className="text-xs text-white/70 font-display font-semibold truncate">{item.target_name}</span>}
                    </div>
                    <span className="text-[9px] text-white/25 flex-shrink-0 tabular-nums">
                      {new Date(item.created_at).toLocaleString('my-MM', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <div className="w-5 h-5 rounded-full bg-brand-700 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                      {item.user?.full_name?.[0] || '?'}
                    </div>
                    <span>{item.user?.full_name || 'System'}</span>
                  </div>

                  {/* Show changed fields */}
                  {changedFields.length > 0 && (
                    <div className="border-t border-white/6 pt-2 space-y-1 overflow-hidden">
                      {changedFields.slice(0, 4).map(field => {
                        const change = item.changes[field]
                        return (
                          <div key={field} className="flex items-start gap-2 text-[10px] overflow-hidden">
                            <span className="font-mono text-white/30 flex-shrink-0 w-[72px] truncate">{field}</span>
                            <span className="text-red-400/70 line-through truncate flex-1">{String(change.before ?? '—').slice(0, 20)}</span>
                            <span className="text-white/20 flex-shrink-0">→</span>
                            <span className="text-green-400/70 truncate flex-1">{String(change.after ?? '—').slice(0, 20)}</span>
                          </div>
                        )
                      })}
                      {changedFields.length > 4 && <p className="text-[9px] text-white/20">+{changedFields.length - 4} more fields</p>}
                    </div>
                  )}

                  {/* Bulk import meta */}
                  {item.action === 'bulk_import' && item.meta && (
                    <div className="flex gap-3 text-[10px] border-t border-white/6 pt-2">
                      <span className="text-white/40">{item.meta.total} rows</span>
                      <span className="text-green-400">{item.meta.success} ok</span>
                      {item.meta.failed > 0 && <span className="text-red-400">{item.meta.failed} failed</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
