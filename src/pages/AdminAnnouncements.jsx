import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

export default function AdminAnnouncements() {
  const navigate = useNavigate()
  const { isAdmin, isModerator } = useAuth()
  const { lang } = useLang()
  useSEO({ title: 'Manage Announcements' })

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [newContent, setNewContent] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin && !isModerator) {
      navigate('/')
      return
    }
    loadAnnouncements()
  }, [isAdmin, isModerator, navigate])

  async function loadAnnouncements() {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setAnnouncements(data || [])
    else console.error(error)
    setLoading(false)
  }

  async function handleAdd() {
    if (!newContent.trim()) return
    const { error } = await supabase
      .from('announcements')
      .insert({ content: newContent.trim() })
    if (error) setError(error.message)
    else {
      setNewContent('')
      setShowNewForm(false)
      loadAnnouncements()
    }
  }

  async function handleUpdate(id) {
    if (!editContent.trim()) return
    const { error } = await supabase
      .from('announcements')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else {
      setEditingId(null)
      setEditContent('')
      loadAnnouncements()
    }
  }

  async function handleToggleActive(id, currentActive) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else loadAnnouncements()
  }

  async function handleDelete(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
    if (error) setError(error.message)
    else loadAnnouncements()
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">
          {lang === 'mm' ? 'ကြေညာချက် စီမံမည်' : 'Manage Announcements'}
        </h1>
      </div>

      <div className="px-4 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Add new button */}
        {!showNewForm ? (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> {lang === 'mm' ? 'ကြေညာချက်အသစ်ထည့်မည်' : 'Add Announcement'}
          </button>
        ) : (
          <div className="card-dark p-4 rounded-2xl space-y-3">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="input-dark w-full font-myanmar text-sm"
              rows="2"
              placeholder={lang === 'mm' ? 'ကြေညာချက် စာသား...' : 'Announcement text...'}
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1">
                <Check size={14} /> {lang === 'mm' ? 'သိမ်းမည်' : 'Save'}
              </button>
              <button onClick={() => setShowNewForm(false)} className="flex-1 btn-ghost text-sm py-2">
                {lang === 'mm' ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* List announcements */}
        {loading ? (
          <div className="text-center py-8 text-white/30">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-white/30 font-myanmar">
            {lang === 'mm' ? 'ကြေညာချက် မရှိသေးပါ' : 'No announcements'}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="card-dark p-4 rounded-2xl">
                {editingId === ann.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="input-dark w-full font-myanmar text-sm"
                      rows="2"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(ann.id)} className="btn-primary text-sm px-3 py-1.5">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-white/80 text-sm font-myanmar whitespace-pre-wrap">{ann.content}</p>
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ann.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {ann.is_active ? 'Active' : 'Hidden'}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {new Date(ann.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleActive(ann.id, ann.is_active)}
                          className="p-1.5 text-white/50 hover:text-white"
                          title={ann.is_active ? 'Hide' : 'Show'}
                        >
                          {ann.is_active ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button
                          onClick={() => { setEditingId(ann.id); setEditContent(ann.content) }}
                          className="p-1.5 text-white/50 hover:text-white"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(ann.id)}
                          className="p-1.5 text-red-400/60 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}