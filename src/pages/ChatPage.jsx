import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Send, ArrowLeft, Loader2 } from 'lucide-react'

export default function ChatPage() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef()

  useEffect(() => {
    loadMessages()

    // Realtime subscription - တစ်ဖက်က ရိုက်တာနဲ့ ကိုယ့်ဆီမှာ တန်းပေါ်ဖို့
    const channel = supabase
      .channel('public_chat')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
    
    if (!error) setMessages(data || [])
    setLoading(false)
    setTimeout(scrollToBottom, 100)
  }

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    const msgContent = newMessage
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      content: msgContent,
      user_id: user.id,
      user_name: profile?.full_name || profile?.nickname || 'Community User',
      created_at: new Date().toISOString()
    })

    if (error) {
      alert(error.message)
      setNewMessage(msgContent)
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0d0015]">
      <div className="px-4 py-3 glass border-b border-white/8 flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 -ml-2 text-white/60">
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h1 className="font-display font-bold text-white text-base">Public Chat</h1>
          <p className="text-[10px] text-brand-400">Live Community</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-400" /></div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.user_id === user?.id
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] text-white/30 mb-1 px-1">{m.user_name}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm font-myanmar ${
                  isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 glass border-t border-white/8 flex gap-2">
        <input 
          value={newMessage} 
          onChange={e => setNewMessage(e.target.value)}
          className="input-dark flex-1 h-12 px-4 rounded-xl text-sm"
          placeholder="စာရိုက်ပါ..."
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="btn-primary w-12 h-12 flex items-center justify-center rounded-xl"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
