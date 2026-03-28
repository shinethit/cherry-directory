import { useState, useEffect, useRef } from 'react'
import { Send, Reply, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function ChatBubble({ msg, isMe, onReply, onDelete, canDelete }) {
  return (
    <div className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          {(msg.user?.full_name || msg.guest_name || '?')[0]}
        </div>
      )}
      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <span className="text-[10px] text-white/40 mb-1 ml-1 font-display">
            {msg.user?.full_name || msg.guest_name || 'Guest'}
          </span>
        )}
        {msg.reply_to && (
          <div className={`text-[10px] text-white/40 mb-1 px-2 py-1 rounded-lg border-l-2 border-brand-400 bg-white/5 ${isMe ? 'self-end' : ''}`}>
            ↩ Reply
          </div>
        )}
        <div className={isMe ? 'bubble-me' : 'bubble-other'}>
          <p className="text-sm text-white font-myanmar leading-relaxed">{msg.content}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-white/25">
            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={() => onReply(msg)} className="text-[9px] text-white/30 hover:text-brand-300 transition-colors flex items-center gap-0.5">
            <Reply size={10} /> Reply
          </button>
          {canDelete && (
            <button onClick={() => onDelete(msg.id)} className="text-[9px] text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-0.5">
              <Trash2 size={10} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user, profile, isLoggedIn, isAdmin, isModerator } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [guestName, setGuestName] = useState(localStorage.getItem('guestName') || '')
  const [replyTo, setReplyTo] = useState(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.from('chat_rooms').select('*').eq('is_active', true).then(({ data }) => {
      setRooms(data || [])
      if (data?.length) setActiveRoom(data[0])
    })
  }, [])

  useEffect(() => {
    if (!activeRoom) return

    let isSubscribed = true

    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, user:profiles(full_name, avatar_url)')
        .eq('room_id', activeRoom.id)
        .order('created_at', { ascending: true })
        .limit(100)
      if (isSubscribed) setMessages(data || [])
    }
    loadMessages()

    const channel = supabase
      .channel(`room-${activeRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoom.id}`,
        },
        async (payload) => {
          const { data: newMsg } = await supabase
            .from('chat_messages')
            .select('*, user:profiles(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()
          if (newMsg && isSubscribed) setMessages(prev => [...prev, newMsg])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoom.id}`,
        },
        (payload) => {
          if (isSubscribed) {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
    }
  }, [activeRoom])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!activeRoom) {
      alert('No chat room selected')
      return
    }
    const content = input.trim()
    if (!content) return

    if (!isLoggedIn && !guestName) {
      setShowNamePrompt(true)
      return
    }

    const messageToSend = {
      room_id: activeRoom.id,
      user_id: user?.id || null,
      guest_name: !isLoggedIn ? guestName : null,
      content,
      reply_to: replyTo?.id || null,
    }

    setInput('')
    setReplyTo(null)

    try {
      const { error } = await supabase.from('chat_messages').insert(messageToSend)
      if (error) console.error('Send error:', error)
    } catch (err) {
      console.error('Send exception:', err)
    }
  }

  async function deleteMessage(messageId) {
    if (!confirm('ဖျက်မည်လား?')) return
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
    if (error) {
      console.error('Delete error:', error)
      alert('ဖျက်ရာတွင် အမှားရှိသည်: ' + error.message)
    }
  }

  function saveGuestName() {
    if (guestName.trim()) {
      localStorage.setItem('guestName', guestName)
      setShowNamePrompt(false)
    }
  }

  const canDelete = (msg) => {
    if (!isLoggedIn) return false
    if (isAdmin || isModerator) return true
    return msg.user_id === user?.id
  }

  if (rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80dvh] p-4 text-center">
        <div className="card-dark p-6 rounded-2xl max-w-sm">
          <span className="text-4xl mb-3 block">💬</span>
          <p className="text-white/70 font-myanmar">Chat room မရှိသေးပါ။</p>
          <p className="text-white/40 text-xs mt-2">Admin မှ room ဖန်တီးပေးရန် လိုအပ်သည်။</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] pb-40" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10rem)' }}>
      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-white/8">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => setActiveRoom(room)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeRoom?.id === room.id ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40' : 'text-white/50 hover:text-white/80'}`}
          >
            {room.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            isMe={isLoggedIn ? msg.user_id === user?.id : msg.guest_name === guestName}
            onReply={setReplyTo}
            onDelete={deleteMessage}
            canDelete={canDelete(msg)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="mx-4 mb-2 px-3 py-2 bg-brand-700/30 border border-brand-500/30 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-brand-300">↩ Replying to {replyTo.user?.full_name || replyTo.guest_name}</p>
            <p className="text-xs text-white/60 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white ml-2"><X size={14} /></button>
        </div>
      )}

      <div className="px-4 pt-3 pb-8 border-t border-white/8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        {!isLoggedIn && guestName && (
          <p className="text-[10px] text-white/30 mb-1.5">Guest: {guestName} • <button onClick={() => setShowNamePrompt(true)} className="text-brand-300 hover:text-brand-200">ပြောင်းရန်</button></p>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={isLoggedIn ? 'မက်ဆေ့ ရေးရန်...' : 'မက်ဆေ့ ရေးရန်... (Guest)'}
            className="input-dark flex-1 text-sm py-2 font-myanmar"
            style={{ fontSize: '16px' }}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-brand-600 disabled:opacity-40 hover:bg-brand-500 transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {showNamePrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNamePrompt(false)}>
          <div className="w-full max-w-lg bg-[#1a0030] border border-white/10 rounded-t-3xl p-6 pb-24" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-white mb-1">နာမည် ထည့်ပါ</h3>
            <p className="text-sm text-white/50 mb-4 font-myanmar">Chat ပြုလုပ်ရန် Guest နာမည် လိုအပ်သည်</p>
            <input
              type="text"
              placeholder="သင်၏ နာမည်..."
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGuestName()}
              className="input-dark mb-3 font-myanmar"
              style={{ fontSize: '16px' }}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={saveGuestName} className="btn-primary flex-1 text-sm">OK</button>
              <button onClick={() => setShowNamePrompt(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
            </div>
            <p className="text-[10px] text-white/30 mt-3 text-center font-myanmar">Login လုပ်ပါက နာမည်ကို automatically သုံးမည်</p>
          </div>
        </div>
      )}
    </div>
  )
}