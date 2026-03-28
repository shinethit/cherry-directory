import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, CheckCircle, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { Skeleton } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

export default function LostFoundDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    supabase.from('lost_found').select('*').eq('id', id).single()
      .then(({ data }) => {
        setPost(data)
        setEditForm(data)
        if (data?.images?.length) {
          setLightboxImages(data.images.map(src => ({ src })))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    const { error } = await supabase.from('lost_found').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else navigate('/lost-found')
  }

  async function handleUpdate() {
    const { error } = await supabase.from('lost_found').update(editForm).eq('id', id)
    if (error) alert('Error: ' + error.message)
    else {
      setPost(editForm)
      setEditing(false)
    }
  }

  function openLightbox(startIndex = 0) {
    setLightboxIndex(startIndex)
    setLightboxOpen(true)
  }

  if (loading) return <div className="p-4"><Skeleton className="h-64" /></div>
  if (!post) return <div className="p-4 text-center text-white/40">မတွေ့ပါ</div>

  const isLost = post.type === 'lost'
  const cover = post.images?.[0] ? getOptimizedUrl(post.images[0], { width: 500 }) : null
  const isOwner = user?.id === post.poster_id
  const canEdit = isOwner || isModerator

  if (editing) {
    return (
      <div className="pb-8">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setEditing(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="font-display font-bold text-lg text-white">ပြင်ဆင်မည်</h1>
          <button onClick={handleUpdate} className="btn-primary text-xs px-4 py-2">သိမ်းမည်</button>
        </div>
        <div className="px-4 space-y-4">
          <input type="text" value={editForm.title_mm || ''} onChange={e => setEditForm({...editForm, title_mm: e.target.value})} className="input-dark" placeholder="ခေါင်းစဉ်" />
          <textarea value={editForm.description_mm || ''} onChange={e => setEditForm({...editForm, description_mm: e.target.value})} className="input-dark resize-none h-32" placeholder="ဖော်ပြချက်" />
          <input type="text" value={editForm.location_mm || ''} onChange={e => setEditForm({...editForm, location_mm: e.target.value})} className="input-dark" placeholder="နေရာ" />
          <input type="text" value={editForm.contact_phone || ''} onChange={e => setEditForm({...editForm, contact_phone: e.target.value})} className="input-dark" placeholder="ဖုန်း" />
          <input type="text" value={editForm.reward || ''} onChange={e => setEditForm({...editForm, reward: e.target.value})} className="input-dark" placeholder="ဆုကြေး" />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {cover && (
        <div className="mx-4 rounded-2xl overflow-hidden h-56 mb-4 cursor-pointer" onClick={() => openLightbox(0)}>
          <img src={cover} alt="" className="w-full h-full object-cover hover:scale-105 transition" />
        </div>
      )}

      <div className="px-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            isLost ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-green-500/15 text-green-400 border-green-500/25'
          }`}>
            {isLost ? 'ပျောက်ဆုံး' : 'တွေ့ရှိ'}
          </span>
          {post.is_urgent && <span className="text-[9px] text-amber-400 font-bold">⚠️ Urgent</span>}
        </div>

        <h1 className="font-display font-bold text-2xl text-white">{post.title_mm || post.title}</h1>

        {post.description_mm && (
          <p className="text-sm text-white/70 font-myanmar leading-relaxed whitespace-pre-wrap">{post.description_mm}</p>
        )}

        {post.location_mm && (
          <div className="flex items-center gap-2 text-white/40">
            <MapPin size={14} />
            <span className="text-sm font-myanmar">{post.location_mm}</span>
          </div>
        )}

        {post.reward && (
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-3">
            <p className="text-gold-400 text-sm font-bold">ဆုကြေး</p>
            <p className="text-white/80 text-sm">{post.reward}</p>
          </div>
        )}

        {post.contact_phone && (
          <a href={`tel:${post.contact_phone}`} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors">
            <Phone size={16} /> {post.contact_phone}
          </a>
        )}

        {post.contact_name && (
          <p className="text-sm text-white/50 font-myanmar">ဆက်သွယ်ရမည့်သူ: {post.contact_name}</p>
        )}

        {post.status === 'resolved' && (
          <div className="flex items-center gap-2 text-green-400 bg-green-500/10 rounded-xl p-3">
            <CheckCircle size={16} />
            <span className="text-sm font-myanmar">ဖြေရှင်းပြီးပါပြီ</span>
          </div>
        )}

        {/* Gallery images with lightbox (if more than one) */}
        {post.images && post.images.length > 1 && (
          <div className="grid grid-cols-3 gap-2">
            {post.images.slice(1).map((img, idx) => (
              <div key={idx} className="aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => openLightbox(idx + 1)}>
                <img src={getOptimizedUrl(img, { width: 200 })} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        plugins={[Zoom, Thumbnails]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  )
}