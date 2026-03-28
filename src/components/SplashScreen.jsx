import { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onFinish, 300);
    }, 2000); // 2 စက္ကန့်ပြီးမှ ပျောက်မယ်
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0d0015] to-[#1a0030] transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center">
        <div className="w-20 h-20 mb-4 mx-auto relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
          <div className="relative flex items-center justify-center w-full h-full rounded-full bg-brand-600/30 backdrop-blur-sm">
            <span className="text-5xl">🍒</span>
          </div>
        </div>
        <h1 className="font-display font-bold text-2xl text-white">Cherry Directory</h1>
        <p className="text-white/50 text-sm mt-2 font-myanmar">တောင်ကြီးမြို့ • ပြည်တွင်းလမ်းညွှန်</p>
        <div className="mt-6 flex gap-1 justify-center">
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}