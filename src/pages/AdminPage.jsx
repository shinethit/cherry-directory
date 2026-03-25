import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Eye, Pencil, Trash2, AlertCircle, Save, LayoutDashboard, List, FolderTree, Users, Link as LinkIcon, UserCog, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CategoryManagerPage from './CategoryManagerPage'

const PRESET_LINKS = [
  { url: '', label: '-- App ထဲရှိ စာမျက်နှာတစ်ခုကို ရွေးပါ --' },
  { url: '/prices', label: '🛒 ဈေးနှုန်းဘုတ် (Market Prices)', icon: '🛒', title: 'Market Prices', title_mm: 'ဈေးနှုန်းဘုတ်', subtitle: 'Market Prices', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/chat', label: '💬 Public Chat (ပြောဆိုရေး)', icon: '💬', title: 'Public Chat', title_mm: 'Public Chat', subtitle: 'ပြောဆိုရေး', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/submit', label: '➕ လုပ်ငန်းထည့်မည် (Submit Listing)', icon: '➕', title: 'Submit Listing', title_mm: 'လုပ်ငန်းထည့်မည်', subtitle: 'Submit Listing', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/emergency', label: '🆘 အရေးပေါ် (Emergency)', icon: '🆘', title: 'Emergency', title_mm: 'အရေးပေါ်', subtitle: 'Emergency', css: 'bg-gradient-to-br from-red-600/25 to-red-700/10 border border-red-500/30 text-white hover:border-red-500/50' },
  { url: '/power', label: '⚡ လျှပ်စစ်အခြေအနေ (Power Status)', icon: '⚡', title: 'Power Status', title_mm: 'လျှပ်စစ်အခြေအနေ', subtitle: 'မီးပျက်/မီးလာ', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/fuel', label: '⛽ ဓာတ်ဆီအခြေအနေ (Fuel Status)', icon: '⛽', title: 'Fuel Status', title_mm: 'ဓာတ်ဆီအခြေအနေ', subtitle: 'ဆီရ/မရ', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/news', label: '📰 သတင်းနှင့် ဖြစ်ရပ်များ (News & Events)', icon: '📰', title: 'News & Events', title_mm: 'သတင်းများ', subtitle: 'နောက်ဆုံးရသတင်း', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: 'custom', label: '🔗 အခြားလင့်ခ် ကိုယ်တိုင်ထည့်မည် (Custom URL)' }
]

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab]                 = useState('dashboard') 
  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [listingFilter, setListingFilter] = useState('all')
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({})
  const [reports, setReports]         = useState({})
  const [showReports, setShowReports] = useState(null)
  const [toast, setToast]             = useState(null)
  const [deleting, setDeleting]       = useState(null)

  const [stats, setStats] = useState({ total: 0, todayNew: 0, todayActive: 0, online: 0 })
  const [statsLoading, setStatsLoading] = useState(false)
  const [usersList, setUsersList] = useState([])
  const [userSearch, setUserSearch] = useState('')

  const [quickLinks, setQuickLinks] = useState([])
  const [editingLink, setEditingLink] = useState(null)
  const [linkForm, setLinkForm] = useState({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true })

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadListings() {
    setLoading(true)
    try {
      let query = supabase
        .from('listings')
        .select('*, category:categories(name, name_mm), submitter:profiles!submitted_by(full_name)')
        .order('created_at', { ascending: false })

      if (listingFilter === 'hidden')   query = query.eq('status', 'hidden')
      else if (listingFilter === 'approved') query = query.eq('status', 'approved')
      else if (listingFilter === 'pending')  query = query.eq('status', 'pending')
      else query = query.neq('status', 'hidden')

      const { data: rows } = await query
      setData(rows || [])

      if (rows) {
        const reportCounts = {}
        for (const listing of rows) {
          const { count } = await supabase
            .from('listing_reports')
            .select('*', { count: 'exact', head: true })
            .eq('listing_id', listing.id)
          reportCounts[listing.id] = count || 0
        }
        setReports(reportCounts)
      }
    } catch (e) { console.error('loadListings error:', e) }
    setLoading(false)
  }

  async function loadDashboardStats() {
    setStatsLoading(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { count: total } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      const { count: todayNew } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
      const { count: todayActive } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', todayStr)
      const { count: online } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', fiveMinsAgo)

      setStats({
        total: total || 0,
        todayNew: todayNew || 0,
        todayActive: todayActive || 0,
        online: online || 0
      })
    } catch (e) { console.warn('Stats Error:', e) }
    setStatsLoading(false)
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setUsersList(data || [])
    } catch (e) { console.warn('Load users error:', e) }
    setLoading(false)
  }

  async function handleRoleChange(userId, newRole) {
    if (!window.confirm(`ဒီ User ကို ${newRole.toUpperCase()} Role ပြောင်းပေးမှာ သေချာပြီလား?`)) return
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
      if (error) throw error
      showToast(`✓ Role ကို ${newRole} သို့ ပြောင်းလဲပြီးပါပြီ`)
      loadUsers()
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error')
    }
  }

  async function loadQuickLinks() {
    try {
      const { data } = await supabase.from('quick_links').select('*').order('sort_order')
      setQuickLinks(data || [])
    } catch (e) { console.warn(e) }
  }

  useEffect(() => {
    if (tab === 'listings') loadListings()
    if (tab === 'dashboard') loadDashboardStats()
    if (tab === 'quicklinks') loadQuickLinks()
    if (tab === 'users') loadUsers()
  }, [tab, listingFilter])

  // CHERRY VERIFY - Updated approve function
  async function handleApprove(id) {
    await supabase
      .from('listings')
      .update({ 
        status: 'approved',
        is_verified: true,
        verify_type: 'cherry'
      })
      .eq('id', id)
    showToast('✓ အတည်ပြုပြီးပါပြီ (Cherry Verified) 🍒')
    loadListings()
  }

  async function handleHide(id) {
    await supabase.from('listings').update({ status: 'hidden' }).eq('id', id)
    showToast('ဝှက်သိမ်းပြီးပါပြီ')
    loadListings()
  }

  async function handleDelete(id) {
    if (!window.confirm('လုပ်ငန်းကို အမှန်ဖျက်မလား? ဒီလုပ်ငန်းကို ပြန်မရနိုင်ပါ။')) return
    setDeleting(id)
    try {
      await supabase.from('listing_reports').delete().eq('listing_id', id)
      await supabase.from('edit_suggestions').delete().eq('listing_id', id)
      await supabase.from('reviews').delete().eq('listing_id', id)
      const { error } = await supabase.from('listings').delete().eq('id', id)
      if (error) throw error
      showToast('🗑️ ဖျက်ပြီးပါပြီ')
      loadListings()
    } catch (e) { showToast('ဖျက်ရာတွင် အမှားတစ်ခု ဖြစ်သွားသည်', 'error') }
    setDeleting(null)
  }

  function handleEdit(listing) {
    setEditingId(listing.id)
    setEditForm(listing)
  }

  async function handleSaveEdit(id) {
    const { name, name_mm, description, description_mm, address, phone_1, city, township } = editForm
    const { error } = await supabase.from('listings').update({
      name, name_mm, description, description_mm, address, phone_1, city, township
    }).eq('id', id)
    if (error) return showToast('သိမ်းရာတွင် အမှားဖြစ်သည်', 'error')
    
    setEditingId(null)
    showToast('✓ ပြင်ဆင်မှု သိမ်းဆည်းပြီး')
    loadListings()
  }

  async function handleSaveLink() {
    if (!linkForm.title || !linkForm.url) return showToast('Title နှင့် URL ထည့်ရန်လိုအပ်ပါတယ်', 'error')
    
    const payload = { ...linkForm }
    delete payload.id

    if (editingLink) {
      const { error } = await supabase.from('quick_links').update(payload).eq('id', editingLink)
      if (error) return showToast(`Database Error: ${error.message}`, 'error')
      showToast('✓ ပြင်ဆင်ပြီးပါပြီ')
    } else {
      payload.sort_order = quickLinks.length + 1
      const { error } = await supabase.from('quick_links').insert([payload])
      if (error) return showToast(`Database Error: ${error.message}`, 'error')
      showToast('✓ အသစ်ထည့်ပြီးပါပြီ')
    }
    
    setEditingLink(null)
    setLinkForm({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true })
    loadQuickLinks()
  }

  async function handleDeleteLink(id) {
    if (!window.confirm('ဖျက်မှာသေချာပြီလား?')) return
    await supabase.from('quick_links').delete().eq('id', id)
    showToast('ဖျက်ပြီးပါပြီ')
    loadQuickLinks()
  }

  const filteredUsers = usersList.filter(u => 
    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-2 border-b border-white/10 mb-4 sticky top-0 bg-[#140020] z-50">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="font-display font-bold text-lg text-white">Admin Panel</h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'dashboard' ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/40'}`}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => setTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'users' ? 'bg-pink-600 text-white' : 'bg-white/5 text-white/40'}`}>
            <UserCog size={14} /> Users
          </button>
          <button onClick={() => setTab('listings')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'listings' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40'}`}>
            <List size={14} /> Listings
          </button>
          <button onClick={() => setTab('categories')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'categories' ? 'bg-amber-600 text-white' : 'bg-white/5 text-white/40'}`}>
            <FolderTree size={14} /> Categories
          </button>
          <button onClick={() => setTab('quicklinks')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'quicklinks' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>
            <LinkIcon size={14} /> Quick Links
          </button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <h2 className="text-white font-bold font-display flex items-center gap-2">
            <Users size={18} className="text-brand-400" /> Member Status
          </h2>
          {statsLoading ? (
             <p className="text-white/30 text-center py-8">Loading stats...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="card-dark p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Total Registered</p>
                <p className="text-2xl font-display font-bold text-white">{stats.total}</p>
              </div>
              <div className="card-dark p-4 rounded-2xl border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[10px] text-green-400/70 uppercase tracking-wider font-bold">Online Now</p>
                </div>
                <p className="text-2xl font-display font-bold text-green-400">{stats.online}</p>
              </div>
              <div className="card-dark p-4 rounded-2xl border border-brand-500/20 bg-brand-500/5">
                <p className="text-[10px] text-brand-300/70 uppercase tracking-wider font-bold mb-1">Active Today</p>
                <p className="text-2xl font-display font-bold text-brand-300">{stats.todayActive}</p>
              </div>
              <div className="card-dark p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                <p className="text-[10px] text-blue-300/70 uppercase tracking-wider font-bold mb-1">New Today</p>
                <p className="text-2xl font-display font-bold text-blue-400">+{stats.todayNew}</p>
              </div>
            </div>
          )}
          <p className="text-[9px] text-white/20 mt-4 font-myanmar text-center">
            * Active Today နှင့် Online Now မှန်ကန်ရန် Database တွင် updated_at လိုအပ်ပါသည်။
          </p>
        </div>
      )}

      {tab === 'users' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search size={16} className="text-white/40" />
            <input 
              type="text" 
              placeholder="နာမည်ဖြင့် ရှာရန်..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white w-full font-myanmar placeholder:text-white/30"
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-white/30 text-center py-8">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-white/30 text-center py-8 font-myanmar">User မတွေ့ပါ</p>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                      {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : (user.full_name?.[0] || '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user.full_name || 'Anonymous'}</p>
                      <p className="text-[10px] text-white/40 truncate">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs text-white/50 font-myanmar">Role ပြောင်းရန်:</span>
                    <select 
                      value={user.role || 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`text-xs px-2 py-1.5 rounded-lg border outline-none font-bold ${
                        user.role === 'admin' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' :
                        user.role === 'moderator' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' :
                        'bg-white/5 border-white/10 text-white/60'
                      }`}
                      style={{ backgroundColor: '#1a0030' }}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="animate-fade-in -mt-4">
          <CategoryManagerPage />
        </div>
      )}

      {tab === 'quicklinks' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card-dark p-4 rounded-2xl border border-white/10 space-y-3 relative">
            <h3 className="text-sm font-bold text-white mb-2">{editingLink ? '✏️ Edit Link' : '➕ Add New Link'}</h3>
            
            <div className="mb-3">
              <label className="text-[10px] text-white/50 mb-1.5 block font-myanmar">အမြန်ရွေးချယ်ရန် (Template)</label>
              <select 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== 'custom') {
                    const preset = PRESET_LINKS.find(p => p.url === val);
                    setLinkForm({
                      ...linkForm,
                      title: preset.title,
                      title_mm: preset.title_mm,
                      subtitle: preset.subtitle,
                      icon: preset.icon,
                      url: preset.url,
                      css_classes: preset.css
                    });
                  } else if (val === 'custom') {
                    setLinkForm({...linkForm, url: ''});
                  }
                  e.target.value = '';
                }}
                className="input-dark text-xs w-full font-myanmar bg-white/5 border border-white/20"
                style={{ backgroundColor: '#1a0030' }}
              >
                {PRESET_LINKS.map(p => <option key={p.url || 'none'} value={p.url}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
              <input value={linkForm.title} onChange={e => setLinkForm({...linkForm, title: e.target.value})} placeholder="Title (EN)" className="input-dark text-xs" />
              <input value={linkForm.title_mm} onChange={e => setLinkForm({...linkForm, title_mm: e.target.value})} placeholder="Title (MM)" className="input-dark text-xs font-myanmar" />
              <input value={linkForm.subtitle} onChange={e => setLinkForm({...linkForm, subtitle: e.target.value})} placeholder="Subtitle" className="input-dark text-xs" />
              <div className="flex gap-2">
                <input value={linkForm.icon} onChange={e => setLinkForm({...linkForm, icon: e.target.value})} placeholder="Icon" className="input-dark text-xs w-12 text-center" />
                <input value={linkForm.url} onChange={e => setLinkForm({...linkForm, url: e.target.value})} placeholder="URL" className="input-dark text-xs flex-1" />
              </div>
              <input value={linkForm.css_classes} onChange={e => setLinkForm({...linkForm, css_classes: e.target.value})} placeholder="CSS classes" className="input-dark text-xs col-span-2" />
              <div className="flex items-center gap-2 col-span-2">
                <label className="text-xs text-white/40">Sort Order:</label>
                <input type="number" value={linkForm.sort_order} onChange={e => setLinkForm({...linkForm, sort_order: e.target.value})} className="input-dark text-xs w-16 text-center" />
                <label className="flex items-center gap-2 text-xs text-white/60 ml-4 cursor-pointer">
                  <input type="checkbox" checked={linkForm.is_active} onChange={e => setLinkForm({...linkForm, is_active: e.target.checked})} className="w-4 h-4" />
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveLink} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                {editingLink ? 'Update' : 'Save Link'}
              </button>
              {editingLink && (
                <button onClick={() => { setEditingLink(null); setLinkForm({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true }) }} 
                  className="flex-1 bg-white/10 text-white/50 text-xs font-bold py-2.5 rounded-xl hover:bg-white/20 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {quickLinks.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">Link များ မရှိသေးပါ</p>
            ) : (
              quickLinks.map(link => (
                <div key={link.id} className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${link.is_active ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10 opacity-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{link.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{link.title_mm || link.title}</p>
                      <p className="text-[10px] text-white/40">{link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded-lg text-white/30 mr-2">Sort: {link.sort_order}</span>
                    <button onClick={() => { setEditingLink(link.id); setLinkForm(link) }} className="w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDeleteLink(link.id)} className="w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'listings' && (
        <div className="animate-fade-in">
          <div className="px-4 mb-4 flex gap-2 flex-wrap">
            {[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending'], ['hidden', 'Hidden']].map(([val, label]) => (
              <button key={val} onClick={() => setListingFilter(val)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  listingFilter === val
                    ? 'bg-blue-600/30 border-blue-400/40 text-blue-200'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}>
                {label}
                {val === 'pending' && data.filter(d => d.status === 'pending').length > 0 && listingFilter !== 'pending' && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-[8px] text-white">
                    {data.filter(d => d.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="px-4 space-y-2">
            {loading ? (
              <p className="text-white/30 text-center py-8">Loading...</p>
            ) : data.length === 0 ? (
              <p className="text-white/30 text-center py-8">No listings found</p>
            ) : (
              data.map(item => (
                <div key={item.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name" />
                      <input value={editForm.name_mm || ''} onChange={e => setEditForm({...editForm, name_mm: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm font-myanmar" placeholder="Name (Myanmar)" />
                      <textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm" placeholder="Description" rows="3" />
                      <input value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm" placeholder="Address" />
                      <input value={editForm.phone_1 || ''} onChange={e => setEditForm({...editForm, phone_1: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm" placeholder="Phone" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(item.id)} className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"><Save size={14} /> SAVE</button>
                        <button onClick={() => setEditingId(null)} className="flex-1 px-3 py-2 bg-white/8 text-white/40 rounded-lg text-xs font-bold">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.name_mm || item.name}</p>
                          <p className="text-[10px] text-white/40">{item.category?.name_mm || item.category?.name} • {item.city}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{item.address}</p>
                          {item.submitter && <p className="text-[9px] text-white/20 mt-0.5">တင်သွင်းသူ: {item.submitter.full_name}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${
                          item.status === 'approved' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                          item.status === 'hidden'   ? 'bg-red-500/20   border-red-500/30   text-red-400' :
                                                       'bg-amber-500/20 border-amber-500/30 text-amber-400'
                        }`}>{item.status.toUpperCase()}</span>
                      </div>

                      {reports[item.id] > 0 && (
                        <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                          <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><AlertCircle size={12} /> {reports[item.id]} Reports</span>
                          <button onClick={() => setShowReports(showReports === item.id ? null : item.id)} className="text-[9px] text-red-400 hover:text-red-300">
                            {showReports === item.id ? 'ပိတ်မည်' : 'ကြည့်မည်'}
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        {item.status !== 'approved' && (
                          <button onClick={() => handleApprove(item.id)} className="flex-1 min-w-[70px] px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <Check size={12} /> APPROVE 🍒
                          </button>
                        )}
                        {item.status === 'approved' && (
                          <button onClick={() => handleHide(item.id)} className="flex-1 min-w-[70px] px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <X size={12} /> HIDE
                          </button>
                        )}
                        <button onClick={() => handleEdit(item)} className="flex-1 min-w-[60px] px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                          <Pencil size={12} /> EDIT
                        </button>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="flex-1 min-w-[70px] px-3 py-1.5 bg-red-600/30 border border-red-600/40 text-red-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                          <Trash2 size={12} /> {deleting === item.id ? '...' : 'DELETE'}
                        </button>
                        <button onClick={() => navigate(`/directory/${item.id}`)} className="flex-1 min-w-[55px] px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                          <Eye size={12} /> VIEW
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-28 left-4 right-4 z-[300] px-4 py-3 rounded-2xl text-center text-sm font-myanmar border shadow-xl ${
          toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 'bg-green-500/90 border-green-400 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
