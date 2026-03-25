import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { Search, MapPin, Star, Filter, ArrowLeft } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSEO } from '../hooks/useSEO'

// --- INTERNAL COMPONENT: ListingCard ---
// ဒီနေရာမှာ Cherry Badge logic ကို ထည့်ထားပါတယ်
const ListingCard = ({ listing, lang }) => {
  const navigate = useNavigate()
  
  return (
    <div 
      onClick={() => navigate(`/directory/${listing.id}`)}
      className="bg-white/5 border border-white/10 rounded-2xl p-3 flex gap-4 cursor-pointer active:scale-95 transition-all"
    >
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
        <img 
          src={listing.cover_url || 'https://via.placeholder.com/150'} 
          className="w-full h-full object-cover"
          alt={listing.name}
        />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white font-bold text-sm truncate font-myanmar">
            {lang === 'mm' ? (listing.name_mm || listing.name) : listing.name}
          </h3>

          {/* ✅ CHERRY VERIFIED BADGE */}
          {listing.is_verified && (
            <div className="flex-shrink-0 flex items-center bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
               <span className="text-[10px]">🍒</span>
               <span className="text-[8px] text-amber-500 font-bold ml-1 uppercase tracking-tighter">Verified</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-white/40 text-[11px] mb-2">
          <MapPin size={10} />
          <span className="truncate font-myanmar">
            {lang === 'mm' ? (listing.address_mm || listing.address) : listing.address}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-white/80 text-[10px] font-bold">{listing.avg_rating || '5.0'}</span>
          </div>
          <span className="text-[10px] text-white/20">|</span>
          <span className="text-[10px] text-brand-400 font-medium font-myanmar">
            {listing.category?.name_mm || 'လုပ်ငန်း'}
          </span>
        </div>
      </div>
    </div>
  )
}

// --- MAIN PAGE COMPONENT ---
export default function DirectoryPage() {
  const { lang } = useLang()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState(searchParams.get('cat') || 'all')

  useSEO({ title: lang === 'mm' ? 'စီးပွားရေးလမ်းညွှန်' : 'Business Directory' })

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadListings()
  }, [activeCat, search])

  async function loadCategories() {
    try {
      const { data } = await supabase.from('categories').select('*').order('name_en')
      setCategories(data || [])
    } catch (e) { console.error(e) }
  }

  async function loadListings() {
    setLoading(true)
    try {
      let query = supabase
        .from('listings')
        .select('*, category:categories(name_mm, name_en)')
        .eq('status', 'active')
        .order('is_verified', { ascending: false }) // Verified ဖြစ်တဲ့သူကို အပေါ်မှာအရင်ပြမယ်
        .order('created_at', { ascending: false })

      if (activeCat !== 'all') {
        query = query.eq('category_id', activeCat)
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,name_mm.ilike.%${search}%`)
      }

      const { data } = await query
      setListings(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="pb-20">
      {/* Header & Search Section */}
      <div className="glass sticky top-0 z-50 px-4 pt-4 pb-3 space-y-3 border-b border-white/5 bg-[#0d0015]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/60 p-1 -ml-1"><ArrowLeft size={20}/></button>
          <h1 className="text-xl font-bold text-white">
            {lang === 'mm' ? 'လမ်းညွှန်' : 'Directory'}
          </h1>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-brand-500 outline-none transition-all font-myanmar"
            placeholder={lang === 'mm' ? 'ရှာဖွေရန်...' : 'Search businesses...'}
          />
        </div>

        {/* Categories Scroll */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setActiveCat('all')}
            className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              activeCat === 'all' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white/5 text-white/50 border border-white/5'
            }`}
          >
            {lang === 'mm' ? 'အားလုံး' : 'All'}
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                activeCat === cat.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white/5 text-white/50 border border-white/5 font-myanmar'
              }`}
            >
              {lang === 'mm' ? cat.name_mm : cat.name_en}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Results */}
      <div className="p-4 space-y-3">
        {loading ? (
          [1,2,3,4].map(n => (
            <div key={n} className="h-24 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : listings.length > 0 ? (
          listings.map(item => (
            <ListingCard key={item.id} listing={item} lang={lang} />
          ))
        ) : (
          <div className="py-20 text-center text-white/20">
            <p className="font-myanmar">{lang === 'mm' ? 'ရှာဖွေမှုမရှိပါ' : 'No results found'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
