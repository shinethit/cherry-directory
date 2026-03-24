import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Eye, Building2, Flag, Users, Pencil, Trash2, AlertCircle, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('listings')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [listingFilter, setListingFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [reports, setReports] = useState({})
  const [showReports, setShowReports] = useState(null)

  async function loadListings() {
    setLoading(true)
    try {
      let query = supabase.from('listings').select('*, category:categories(name, name_mm), submitter:profiles!submitted_by(full_name)').order('created_at', { ascending: false })
      
      if (listingFilter === 'hidden') query = query.eq('status', 'hidden')
      else if (listingFilter === 'approved') query = query.eq('status', 'approved')
      else if (listingFilter === 'all') query = query.neq('status', 'hidden')
      
      const { data } = await query
      setData(data || [])

      // Load report counts for each listing
      if (data) {
        const reportCounts = {}
        for (const listing of data) {
          const { count } = await supabase.from('listing_reports').select('*', { count: 'exact', head: true }).eq('listing_id', listing.id)
          reportCounts[listing.id] = count || 0
        }
        setReports(reportCounts)
      }
    } catch (e) { console.error('loadListings error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadListings() }, [listingFilter])

  async function handleApprove(id) {
    await supabase.from('listings').update({ status: 'approved' }).eq('id', id)
    loadListings()
  }

  async function handleHide(id) {
    await supabase.from('listings').update({ status: 'hidden' }).eq('id', id)
    loadListings()
  }

  async function handleEdit(listing) {
    setEditingId(listing.id)
    setEditForm(listing)
  }

  async function handleSaveEdit(id) {
    const { name, name_mm, description, description_mm, address, phone_1, city, township } = editForm
    await supabase.from('listings').update({
      name, name_mm, description, description_mm, address, phone_1, city, township
    }).eq('id', id)
    setEditingId(null)
    loadListings()
  }

  async function loadReportsForListing(listingId) {
    const { data } = await supabase.from('listing_reports').select('*, reporter:profiles(full_name)').eq('listing_id', listingId)
    return data || []
  }

  if (tab === 'listings') {
    return (
      <div className="pb-8">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
          <h1 className="font-display font-bold text-lg text-white">Admin Panel</h1>
        </div>

        {/* Filter buttons */}
        <div className="px-4 mb-4 flex gap-2">
          {[['all', 'All'], ['approved', 'Approved'], ['hidden', 'Hidden']].map(([val, label]) => (
            <button key={val} onClick={() => setListingFilter(val)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                listingFilter === val ? 'bg-brand-600/30 border-brand-400/40 text-brand-200' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Listings */}
        <div className="px-4 space-y-2">
          {loading ? <p className="text-white/30">Loading...</p> :
           data.length === 0 ? <p className="text-white/30 text-center py-8">No listings</p> :
           data.map(item => (
            <div key={item.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
              {editingId === item.id ? (
                // Edit mode
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
                // View mode
                <>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-white/40">{item.category?.name_mm} • {item.city}</p>
                      <p className="text-[10px] text-white/30 mt-1">{item.address}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${
                      item.status === 'approved' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                      item.status === 'hidden' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                      'bg-amber-500/20 border-amber-500/30 text-amber-400'
                    }`}>{item.status.toUpperCase()}</span>
                  </div>

                  {/* Report count badge */}
                  {reports[item.id] > 0 && (
                    <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                      <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><AlertCircle size={12} /> {reports[item.id]} Reports</span>
                      <button onClick={() => setShowReports(showReports === item.id ? null : item.id)} className="text-[9px] text-red-400 hover:text-red-300">View</button>
                    </div>
                  )}

                  {/* Reports detail */}
                  {showReports === item.id && (
                    <div className="mb-2 p-2 rounded-lg bg-white/3 border border-white/8 text-[9px] text-white/60 max-h-24 overflow-y-auto">
                      <p className="font-bold mb-1">Reports:</p>
                      {/* Reports would be loaded here */}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    {item.status === 'hidden' && (
                      <button onClick={() => handleApprove(item.id)} className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Check size={12} /> APPROVE</button>
                    )}
                    {item.status === 'approved' && (
                      <button onClick={() => handleHide(item.id)} className="flex-1 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><X size={12} /> HIDE</button>
                    )}
                    <button onClick={() => handleEdit(item)} className="flex-1 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Pencil size={12} /> EDIT</button>
                    <button onClick={() => navigate(`/directory/${item.id}`)} className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Eye size={12} /> VIEW</button>
                  </div>
                </>
              )}
            </div>
           ))}
        </div>
      </div>
    )
  }

  return <div className="p-8 text-center text-white/40">Other tabs coming soon...</div>
}
