import { useNavigate } from 'react-router-dom'
import { useSEO } from '../hooks/useSEO'

// H8: 404 page — the old catch-all route silently redirected to Home.
// The route itself is wired by the coordinator (App.jsx is not a Track H file).
export default function NotFoundPage() {
  const navigate = useNavigate()
  useSEO({ title: 'စာမျက်နှာ မတွေ့ပါ' })
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-24">
      <span className="text-6xl mb-4">🔍</span>
      <p className="font-display font-bold text-4xl text-white">404</p>
      <h1 className="font-display font-bold text-xl text-white mt-2 font-myanmar">စာမျက်နှာ မတွေ့ပါ</h1>
      <p className="text-sm text-white/60 mt-2 font-myanmar leading-relaxed">
        သင်ရှာသော စာမျက်နှာသည် မရှိတော့ပါ (သို့မဟုတ်) လင့်ခ် မှားနေပါသည်။
      </p>
      <button onClick={() => navigate('/')} className="btn-primary text-sm mt-6">
        Home သို့ ပြန်သွားမည်
      </button>
    </div>
  )
}
