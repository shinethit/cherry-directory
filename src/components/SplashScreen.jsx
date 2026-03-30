import { useState } from 'react';
import { Check } from 'lucide-react';

export default function SplashScreen({ onConsent }) {
  const [agreed, setAgreed] = useState(false);

  const handleAgree = () => {
    setAgreed(true);
    setTimeout(() => {
      onConsent();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0d0015] to-[#1a0030] p-6 overflow-y-auto">
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        {/* Logo */}
        <div className="w-28 h-28 mx-auto rounded-full bg-brand-600/30 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-xl">
          <span className="text-6xl">🍒</span>
        </div>

        {/* App Name */}
        <h1 className="font-display font-bold text-3xl text-white">Cherry Directory</h1>
        <p className="text-brand-300 text-sm">တောင်ကြီးမြို့ • ဒေသဆိုင်ရာ အချက်အလက် ဖလှယ်ရေး</p>

        {/* App Description (from AboutPage) */}
        <div className="space-y-2 text-white/70 text-sm font-myanmar text-left">
          <p>
            Cherry Directory သည် ဒေသတွင်း လုပ်ငန်းများ၊ သတင်းများ၊ ဖြစ်ရပ်များ၊ 
            လျှပ်စစ်အခြေအနေ၊ ဓာတ်ဆီရရှိမှု၊ ဈေးနှုန်းများကို Community မှ 
            တိုက်ရိုက်တင်ပြသော ပလက်ဖောင်းဖြစ်ပါသည်။
          </p>
          <p className="text-xs text-white/40">
            Version 2.0 • Since 2026 • by Shine Thit
          </p>
        </div>

        {/* Disclaimer Box (from PrivacyPage) */}
        <div className="bg-amber-500/15 border-2 border-red-500/60 rounded-2xl p-4 text-left">
          <div className="flex gap-3">
            <span className="text-3xl text-red-500 animate-pulse">⚠️</span>
            <div>
              <p className="text-red-400 font-bold text-sm mb-1 font-myanmar">သတိပြုရန် အရေးကြီး</p>
              <p className="text-amber-300 text-xs leading-relaxed font-myanmar">
                ဤ Application အတွင်းရှိ Data များသည် Public မှ တိုက်ရိုက်လာသော Data များဖြစ်ပြီး 
                Application ဖန်တီးသူနှင့် သက်ဆိုင်ခြင်းမရှိပါ။
                အဆက်အသွယ်များ၊ ဖုန်းများကို မိမိတို့ဘာသာ ချင့်ချိန်သုံးစွဲကြပါရန်။
              </p>
              <p className="text-red-400/80 text-[10px] mt-2 font-myanmar">
                ⚡ Community မှ တင်ပြသော အချက်အလက်များဖြစ်သဖြင့် တိကျမှုကို အာမခံနိုင်မည် မဟုတ်ပါ။
              </p>
            </div>
          </div>
        </div>

        {/* Consent Button */}
        <button
          onClick={handleAgree}
          disabled={agreed}
          className={`mt-4 btn-primary flex items-center justify-center gap-2 w-full text-sm transition-all ${agreed ? 'opacity-50' : 'hover:scale-105'}`}
        >
          <Check size={16} />
          {agreed ? 'ဆောင်ရွက်နေသည်...' : 'သဘောတူသည်။ စတင်အသုံးပြုပါမည်'}
        </button>

        {/* Version note */}
        <p className="text-[10px] text-white/20 mt-4">သင်၏ အချက်အလက်များကို Privacy Policy နှင့် Terms of Service အရ ကာကွယ်ထားပါသည်။</p>
      </div>
    </div>
  );
}