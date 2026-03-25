import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'

export default function HomePage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const [allCategories, setAllCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'directory')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('sort_order')
      setAllCategories(data || [])
    }
    load()
  }, [])

  const homeCategories = allCategories.filter(c => !c.parent_id)

  const closeAndNavigate = (url) => {
    setSelectedCat(null)
    setSelectedSub(null)
    setTimeout(() => navigate(url), 20)
  }

  return (
    <div className="p-4">
      <h1 className="text-white text-xl mb-4">Test Category Grid</h1>
      <div className="grid grid-cols-4 gap-2">
        {homeCategories.map(cat => {
          const subs = allCategories.filter(c => c.parent_id === cat.id)
          return (
            <button
              key={cat.id}
              onClick={() => subs.length > 0 ? setSelectedCat(cat) : navigate(`/directory?cat=${cat.id}`)}
              className="p-3 bg-white/10 rounded-2xl flex flex-col items-center"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs text-white/80 mt-1">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</span>
            </button>
          )
        })}
      </div>

      {/* Centered modal for subcategories */}
      {selectedCat && (
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedCat(null)}
        >
          <div 
            className="bg-[#140020] border border-white/10 rounded-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedCat.icon}</span>
                <p className="font-display font-bold text-white">
                  {lang === 'mm' ? (selectedCat.name_mm || selectedCat.name) : selectedCat.name}
                </p>
              </div>
              <button onClick={() => setSelectedCat(null)} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">
                ✕
              </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              <button
                onClick={() => closeAndNavigate(`/directory?cat=${selectedCat.id}`)}
                className="p-3 card-dark rounded-xl flex flex-col items-center"
              >
                <span className="text-xl">📋</span>
                <span className="text-[9px] text-white/50">All</span>
              </button>
              {allCategories.filter(c => c.parent_id === selectedCat.id).map(sub => {
                const subSubs = allCategories.filter(c => c.parent_id === sub.id)
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (subSubs.length > 0) {
                        setSelectedSub(sub)
                        setSelectedCat(null)
                      } else {
                        closeAndNavigate(`/directory?cat=${sub.id}`)
                      }
                    }}
                    className="p-3 card-dark rounded-xl flex flex-col items-center"
                  >
                    <span className="text-xl">{sub.icon}</span>
                    <span className="text-[9px] text-white/60">{lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal for sub-subcategories */}
      {selectedSub && (
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedSub(null)}
        >
          <div 
            className="bg-[#140020] border border-white/10 rounded-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedSub.icon}</span>
                <p className="font-display font-bold text-white">
                  {lang === 'mm' ? (selectedSub.name_mm || selectedSub.name) : selectedSub.name}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">
                ✕
              </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              <button
                onClick={() => closeAndNavigate(`/directory?cat=${selectedSub.id}`)}
                className="p-3 card-dark rounded-xl flex flex-col items-center"
              >
                <span className="text-xl">📋</span>
                <span className="text-[9px] text-white/50">All</span>
              </button>
              {allCategories.filter(c => c.parent_id === selectedSub.id).map(ss => (
                <button
                  key={ss.id}
                  onClick={() => closeAndNavigate(`/directory?cat=${ss.id}`)}
                  className="p-3 card-dark rounded-xl flex flex-col items-center"
                >
                  <span className="text-xl">{ss.icon}</span>
                  <span className="text-[9px] text-white/60">{lang === 'mm' ? (ss.name_mm || ss.name) : ss.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
