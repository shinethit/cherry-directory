import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';

const EMOJI_CATEGORIES = {
  '🛍️ Business & Services': [
    '🏪', '🏨', '🏥', '💊', '🍽️', '🍔', '☕', '🛒', '🏧', '💈', '✂️', '💅', '👗', '👔', '👕', '👜', '👠', '💍', '📱', '💻', '🖥️', '🖨️', '📠', '📞', '✉️', '📦', '🚚', '🔧', '⚙️', '🔨', '🪚', '🧰', '🔩', '🧲', '⚖️', '💰', '💵', '💶', '💷', '💴', '🏦', '📈', '📉', '💎', '🏆', '🎓', '📚', '✏️', '📝', '🗂️', '📁', '📎', '🔗', '📌', '📍'
  ],
  '📰 News & Events': [
    '📰', '📢', '📅', '🎉', '🎭', '🎬', '🏆', '🎓', '📚', '✍️', '🎤', '🎸', '🎧', '📻', '📺', '🎥', '📷', '🎨', '🏀', '⚽', '🎮', '🎲', '🧩', '🃏', '🎯'
  ],
  '🚌 Transportation': [
    '🚌', '🚕', '🚲', '🛵', '🚛', '🚗', '🚆', '✈️', '🚢', '🚁', '🚀', '🛸', '⛽', '🛞', '🚦', '🚧', '🗺️'
  ],
  '⚡ Utilities': [
    '⚡', '💧', '🔥', '🛢️', '💨', '🌊', '☀️', '🌙', '💡', '🔌', '🔋', '🧯', '🚰', '🚽', '🧹', '🧺', '🧼', '🧽', '🧴', '🧻'
  ],
  '🏠 Home & Living': [
    '🏠', '🏢', '🏭', '🏪', '🏫', '🏥', '🏦', '🏛️', '🛋️', '🛏️', '🚪', '🔑', '🪑', '🚽', '🛁', '🧸', '🎁', '🖼️', '🔔', '🕯️', '🧧', '🎀'
  ],
  '👥 People': [
    '👤', '👥', '👨‍👩‍👧', '👩‍⚕️', '👨‍🏫', '👮', '👷', '💼', '👨‍💻', '👩‍🍳', '👨‍🌾', '👩‍🎨', '👨‍🔧', '👩‍🔬', '👨‍🚒', '🧑‍🤝‍🧑', '🙋', '🙌', '👏', '💪', '🧠', '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎'
  ],
  '❤️ Health & Wellness': [
    '❤️', '💊', '🏥', '🧠', '🩺', '💉', '🦷', '🍎', '🥗', '🏋️', '🧘', '🚴', '🏊', '🧖', '💆', '💇'
  ],
  '🌐 Other / Misc': [
    '🌟', '⭐', '✨', '🔥', '💯', '✅', '❌', '⚠️', '❓', '❗', '🔔', '🔕', '💬', '🗣️', '📌', '📍', '🔗', '📎', '✂️', '🖌️', '🎨', '🎵', '🎧', '🎤', '🎸', '🏀', '⚽', '🎮', '📷', '📹', '💻', '📱', '⌚', '📡', '🔋', '🧲', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💎', '💰', '💵', '💶', '💷', '💴', '🏦', '📈', '📉', '🔒', '🔓', '🔑', '🧹', '🧺', '🧼', '🧽', '🧴', '🧻', '🧸', '🎁', '🎈', '🎉', '🎊', '🎀', '🎗️', '🏅', '🥇', '🥈', '🥉', '🏆', '👑', '💍', '📿', '🧿', '🪬', '🪙', '🔮', '🪄', '🪢', '🪣', '🪤', '🪥', '🪦', '🪧', '🪨', '🪩', '🪪', '🪫', '🪬', '🪭', '🪮', '🪯'
  ]
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

export default function IconPicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ALL_EMOJIS;
    const term = search.toLowerCase();
    return ALL_EMOJIS.filter(emoji => emoji === term || emoji.includes(term));
  }, [search]);

  const handleSelect = (emoji) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer w-fit hover:bg-white/10 transition-colors"
      >
        <span className="text-2xl">{value || '😀'}</span>
        <span className="text-xs text-white/50">ပြောင်းမယ်</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70" onClick={() => setOpen(false)}>
          <div className="bg-[#1a0030] rounded-2xl w-full max-w-md border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <h3 className="text-white font-bold">Icon ရွေးမယ်</h3>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-3">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="ရှာမယ်..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-dark pl-8 text-sm w-full"
                />
              </div>
              <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto p-1">
                {filtered.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleSelect(emoji)}
                    className="text-2xl p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}