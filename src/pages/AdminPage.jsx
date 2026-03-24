import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Eye, Building2, Newspaper, Users, MessageCircle, BarChart2, Flag, ShieldCheck, Upload, ScrollText, Radio, ChevronDown, Star } from 'lucide-react'
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

const statusBadge = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  approved: 'bg-green-500/15 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
  published: 'bg-green-500/15 text-green-400 border-green-500/20',
  draft: 'bg-white/8 text-white/40 border-white/10',
}

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

  async function loadStats() {
    try {
      const { data: s } = await supabase.rpc('get_admin_stats')
      if (s) setStats(s)
      
      const { data: c } = await supabase.rpc('get_admin_charts')
      if (c) setChartData(c)
    } catch (e) { console.error(e) }
  }

  async function loadTab() {
    setLoading(true)
    let res;
    if (tab === 'listings') {
      res = await supabase.from('listings')
        .select('*, category:categories(name_mm), submitter:profiles(full_name)')
        .order('created_at', { ascending: false })
      if (listingFilter !== 'all') res = res.eq('status', listingFilter)
    } else if (tab === 'claims') {
      res = await supabase.from('listing_claims')
        .select('*, listing:listings(name, name_mm), claimant:profiles(full_name)')
        .order('created_at', { ascending: false })
    } else if (tab === 'posts') {
      res = await supabase.from('posts')
        .select('*, author:profiles(full_name)')
        .order('created_at', { ascending: false })
    } else if (tab === 'users') {
      res = await supabase.from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
    } else if (tab === 'chat') {
      res = await supabase.from('chat_messages')
        .select('*, user:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
    } else if (tab === 'audit') {
      res = await supabase.from('audit_logs')
        .select('*, user:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
    }
    if (res?.data) setData(res.data)
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])
  useEffect(() => { loadTab() }, [tab, listingFilter])

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

    liveChannelRef.current = supabase.channel('live-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchLive)
      .subscribe()

    return () => { if (liveChannelRef.current) supabase.removeChannel(liveChannelRef.current) }
  }, [])

  const approveListing = async (id) => {
    await supabase.from('listings').update({ status: 'approved' }).eq('id', id)
    loadTab(); loadStats()
  }

  const rejectListing = async (id) => {
    await supabase.from('listings').update({ status: 'rejected' }).eq('id', id)
    loadTab(); loadStats()
  }

  const featureListing = async (id, current) => {
    await supabase.from('listings').update({ is_featured: !current }).eq('id', id)
    loadTab()
  }

  const approveClaim = async (claim) => {
    await supabase.from('listing_claims').update({ status: 'approved' }).eq('id', claim.id)
    await supabase.from('listings').update({ owner_id: claim.claimant_id, is_verified: true }).eq('id', claim.listing_id)
    loadTab(); loadStats()
  }

  const rejectClaim = async (id) => {
    await supabase.from('listing_claims').update({ status: 'rejected' }).eq('id', id)
    loadTab(); loadStats()
  }

  const publishPost = async (id, current) => {
    await supabase.from('posts').update({ status: current === 'published' ? 'draft' : 'published' }).eq('id', id)
    loadTab()
  }

  const pinPost = async (id, current) => {
    await supabase.from('posts').update({ is_pinned: !current }).eq('id', id)
    loadTab()
  }

  const setUserRole = async (id, role) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    loadTab()
  }

  const deleteMessage = async (id) => {
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', id)
    loadTab()
  }

  if (!isAdmin) return null

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0"><ArrowLeft size={18} className="text-white" /></button>
          <h1 className="font-display font-bold text-lg text-white">Admin Panel</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/categories')} className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/12 text-white/60 text-xs font-semibold">Categories</button>
          <button onClick={() => navigate('/admin/settings')} className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/12 text-white/60 text-xs font-semibold">Settings</button>
          <button onClick={() => navigate('/bulk-import')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600/20 border border-brand-400/30 text-brand-300 text-xs font-semibold"><Upload size={13} /> Import</button>
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

      {/* Tab selector */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select value={tab} onChange={e => setTab(e.target.value)} className="w-full appearance-none bg-brand-600/20 border border-brand-400/30 text-brand-200 text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 outline-none">
            {TABS.map(({ id, label, showBadge }) => (
              <option key={id} value={id}>{label}{showBadge && stats[showBadge] > 0 ? ` (${stats[showBadge]})` : ''}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-300 pointer-events-none" />
        </div>
      </div>

      <div className="px-4">
        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="card-dark p-4 rounded-2xl">
              <p className="text-xs font-semibold text-white/50 uppercase mb-3">New Listings (14 days)</p>
              <AnalyticsChart data={chartData.listings} label="Listings" color="#a200e6" />
            </div>
            <div className="card-dark p-4 rounded-2xl">
              <p className="text-xs font-semibold text-white/50 uppercase mb-3">New Posts (14 days)</p>
              <AnalyticsChart data={chartData.posts} label="Posts" color="#22c55e" />
            </div>
          </div>
        )}

        {tab === 'live' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="card-dark rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="font-bold text-xl text-green-400">{liveUsers.length}</p>
                </div>
                <p className="text-[9px] text-white/40">Online</p>
              </div>
            </div>
            {liveUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 card-dark rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <span className="font-bold text-white text-sm">{u.full_name?.[0] || '?'}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{u.nickname ? `@${u.nickname}` : u.full_name || 'User'}</p>
                  <p className="text-[10px] text-green-400">Online • {u.last_seen ? timeAgo(u.last_seen) : 'just now'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'listings' && (
          <>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['all','All']].map(([val, label]) => (
                <button key={val} onClick={() => setListingFilter(val)}
                  className={`py-1.5 rounded-xl text-[10px] font-semibold border transition-colors truncate ${
                    listingFilter === val
                      ? (val === 'pending' ? 'bg-amber-500/25 border-amber-500/40 text-amber-300'
                        : val === 'approved' ? 'bg-green-500/20 border-green-500/35 text-green-300'
                        : val === 'rejected' ? 'bg-red-500/20 border-red-500/35 text-red-300'
                        : 'bg-brand-600/25 border-brand-400/40 text-brand-200')
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}>
                  {val === 'pending' && stats.pending > 0 ? '⏳ (' + stats.pending + ')' : label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {data.length === 0 && <p className="text-white/40 text-sm text-center py-8">No listings</p>}
              {data.map(item => (
                <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-white/40">{item.category?.name_mm} • {item.city}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${statusBadge[item.status]}`}>{item.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.status === 'pending' && (
                      <>
                        <button onClick={() => approveListing(item.id)} className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-xl text-xs text-green-400">Approve</button>
                        <button onClick={() => rejectListing(item.id)} className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl text-xs text-red-400">Reject</button>
                      </>
                    )}
                    <button onClick={() => navigate(`/directory/${item.id}`)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white/50">View</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'claims' && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.listing?.name_mm || item.listing?.name}</p>
                    <p className="text-[10px] text-white/50">by {item.claimant?.full_name}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${statusBadge[item.status]}`}>{item.status}</span>
                </div>
                {item.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => approveClaim(item)} className="px-3 py-2 bg-gold-600/30 border border-gold-500/40 rounded-xl text-xs text-gold-400">Approve</button>
                    <button onClick={() => rejectClaim(item.id)} className="px-3 py-2 bg-red-500/15 border border-red-500/25 rounded-xl text-xs text-red-400">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'posts' && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-white/40">{item.type} • {item.author?.full_name}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${statusBadge[item.status]}`}>{item.status}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => publishPost(item.id, item.status)} className="px-3 py-1.5 rounded-xl text-xs border border-white/10 bg-white/5 text-white/60">{item.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                  <button onClick={() => pinPost(item.id, item.is_pinned)} className={`px-3 py-1.5 rounded-xl text-xs border ${item.is_pinned ? 'bg-gold-500/20 border-gold-500/30 text-gold-400' : 'bg-white/5 border-white/10 text-white/50'}`}>Pin</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white font-bold">{item.full_name?.[0] || '?'}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.full_name}</p>
                    <p className="text-[10px] text-white/40">{item.role}</p>
                  </div>
                </div>
                {isSuperAdmin && item.role !== 'super_admin' && (
                  <select value={item.role} onChange={e => setUserRole(item.id, e.target.value)} className="text-xs bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-white outline-none">
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-3 rounded-xl flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-brand-300 truncate">{item.user?.full_name || 'Guest'}</p>
                  <p className="text-xs text-white/70 line-clamp-2">{item.content}</p>
                </div>
                {!item.is_deleted && <button onClick={() => deleteMessage(item.id)} className="w-7 h-7 bg-red-500/15 rounded-lg text-red-400 flex items-center justify-center"><X size={12} /></button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="card-dark p-4 rounded-2xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] border border-white/10 bg-white/5 text-white/60">{item.action}</span>
                    <span className="text-[10px] text-white/40 font-mono">{item.target_table}</span>
                  </div>
                  <span className="text-[9px] text-white/25">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-white/60">{item.user?.full_name || 'System'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
