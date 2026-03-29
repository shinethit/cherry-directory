import { useState, useEffect, useRef } from 'react'
import { Send, Reply, X, Trash2, Plus, Pencil, Settings } from 'lucide-react'
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

  // Room management state
  const [showRoomManager, setShowRoomManager] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomError, setRoomError] = useState('')

  // Load rooms
  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      setRooms(data || [])
      if (data?.length && !activeRoom) setActiveRoom(data[0])
    } catch (err) {
      console.error('loadRooms error:', err)
      alert('Rooms ရယူရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  useEffect(() => {
    loadRooms()
  }, [])

  // Load messages for active room & set up realtime subscription
  useEffect(() => {
    if (!activeRoom) return

    let isSubscribed = true
    let channel = null

    // Initial load
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*, user:profiles(full_name, avatar_url)')
          .eq('room_id', activeRoom.id)
          .order('created_at', { ascending: true })
          .limit(100)
        if (error) throw error
        if (isSubscribed) setMessages(data || [])
      } catch (err) {
        console.error('loadMessages error:', err)
      }
    }
    loadMessages()

    // Realtime subscription
    channel = supabase
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
          console.log('INSERT payload:', payload)
          // Fetch the newly inserted message with user details
          const { data: newMsg, error } = await supabase
            .from('chat_messages')
            .select('*, user:profiles(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()
          if (!error && newMsg && isSubscribed) {
            setMessages(prev => [...prev, newMsg])
          }
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
          console.log('DELETE payload:', payload)
          if (isSubscribed) {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('Subscription error:', err)
        else console.log('Subscription status:', status)
      })

    return () => {
      isSubscribed = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [activeRoom])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMessage = async () => {
    if (!activeRoom) return
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
      if (error) throw error
    } catch (err) {
      console.error('Send error:', err)
      alert('မက်ဆေ့ ပို့ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!confirm('ဖျက်မည်လား?')) return
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', messageId)
      if (error) throw error
      // Optimistic update: remove from local state immediately
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err) {
      console.error('Delete error:', err)
      alert('ဖျက်ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const saveGuestName = () => {
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

  // Room management functions (unchanged)
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setRoomError('အခန်းအမည် ထည့်ပါ')
      return
    }
    try {
      const maxSort = rooms.length > 0 ? Math.max(...rooms.map(r => r.sort_order || 0)) : 0
      const { error } = await supabase.from('chat_rooms').insert({
        name: newRoomName.trim(),
        description: newRoomDesc.trim() || null,
        is_active: true,
        sort_order: maxSort + 1,
      })
      if (error) throw error
      setNewRoomName('')
      setNewRoomDesc('')
      setRoomError('')
      await loadRooms()
    } catch (err) {
      console.error('Create room error:', err)
      setRoomError('ဖန်တီးရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const handleUpdateRoom = async () => {
    if (!editingRoom) return
    if (!editingRoom.name.trim()) {
      setRoomError('အခန်းအမည် ထည့်ပါ')
      return
    }
    try {
      const { error } = await supabase
        .from('chat_rooms')
        .update({ name: editingRoom.name.trim(), description: editingRoom.description?.trim() || null })
        .eq('id', editingRoom.id)
      if (error) throw error
      setEditingRoom(null)
      setRoomError('')
      await loadRooms()
    } catch (err) {
      console.error('Update room error:', err)
      setRoomError('ပြင်ဆင်ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('ဒီ Room ကို ဖျက်မည်လား? အတွင်းက မက်ဆေ့များပါ ဖျက်မည်။')) return
    try {
      const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId)
      if (error) throw error
      if (activeRoom?.id === roomId) setActiveRoom(null)
      await loadRooms()
    } catch (err) {
      console.error('Delete room error:', err)
      alert('ဖျက်ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const handleReorder = async (roomId, direction) => {
    const index = rooms.findIndex(r => r.id === roomId)
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === rooms.length - 1) return
    const newRooms = [...rooms]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newRooms[index].sort_order
    newRooms[index].sort_order = newRooms[swapIndex].sort_order
    newRooms[swapIndex].sort_order = temp
    try {
      await supabase.from('chat_rooms').update({ sort_order: newRooms[index].sort_order }).eq('id', newRooms[index].id)
      await supabase.from('chat_rooms').update({ sort_order: newRooms[swapIndex].sort_order }).eq('id', newRooms[swapIndex].id)
      await loadRooms()
    } catch (err) {
      console.error('Reorder error:', err)
      alert('အစီအစဉ်ပြောင်းရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  if (rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80dvh] p-4 text-center">
        <div className="card-dark p-6 rounded-2xl max-w-sm">
          <span className="text-4xl mb-3 block">💬</span>
          <p className="text-white/70 font-myanmar">Chat room မရှိသေးပါ။</p>
          {(isAdmin || isModerator) && (
            <button onClick={() => setShowRoomManager(true)} className="btn-primary text-xs px-3 py-1.5 mt-3">
              Room အသစ်ဖန်တီးမည်
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Room tabs header */}
      <div className="sticky top-0 z-10 bg-[#140020] border-b border-white/8">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeRoom?.id === room.id
                    ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
          {(isAdmin || isModerator) && (
            <button
              onClick={() => setShowRoomManager(true)}
              className="ml-2 text-brand-300 p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title="Manage rooms"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages container */}
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

      {/* Reply indicator */}
      {replyTo && (
        <div className="mx-4 mb-2 px-3 py-2 bg-brand-700/30 border border-brand-500/30 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-brand-300">↩ Replying to {replyTo.user?.full_name || replyTo.guest_name}</p>
            <p className="text-xs text-white/60 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white ml-2"><X size={14} /></button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pt-3 pb-4 border-t border-white/8" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {!isLoggedIn && guestName && (
          <p className="text-[10px] text-white/30 mb-1.5">
            Guest: {guestName} •{' '}
            <button onClick={() => setShowNamePrompt(true)} className="text-brand-300 hover:text-brand-200">
              ပြောင်းရန်
            </button>
          </p>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
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

      {/* Room Manager Modal */}
      {showRoomManager && (isAdmin || isModerator) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowRoomManager(false)}>
          <div className="bg-[#140020] rounded-2xl w-full max-w-md border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h3 className="font-display font-bold text-white">Chat Room စီမံမည်</h3>
              <button onClick={() => setShowRoomManager(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {roomError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 text-xs text-red-400">
                  {roomError}
                </div>
              )}
              {/* Create new room */}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="အခန်းအမည် (မြန်မာ/အင်္ဂလိပ်)"
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  className="input-dark text-sm"
                />
                <input
                  type="text"
                  placeholder="ဖော်ပြချက် (optional)"
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  className="input-dark text-sm"
                />
                <button onClick={handleCreateRoom} className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-1">
                  <Plus size={14} /> အခန်းသစ်ထည့်မည်
                </button>
              </div>

              {/* Existing rooms */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                {rooms.map((room, idx) => (
                  <div key={room.id} className="bg-white/5 rounded-xl p-3">
                    {editingRoom?.id === room.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingRoom.name}
                          onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })}
                          className="input-dark text-sm w-full"
                        />
                        <input
                          type="text"
                          value={editingRoom.description || ''}
                          onChange={e => setEditingRoom({ ...editingRoom, description: e.target.value })}
                          className="input-dark text-sm w-full"
                          placeholder="ဖော်ပြချက်"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleUpdateRoom} className="flex-1 btn-primary text-xs py-1.5">
                            သိမ်းမည်
                          </button>
                          <button onClick={() => setEditingRoom(null)} className="flex-1 btn-ghost text-xs py-1.5">
                            မလုပ်တော့ပါ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-white font-semibold">{room.name}</p>
                          {room.description && <p className="text-xs text-white/50">{room.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex flex-col">
                            {idx > 0 && (
                              <button onClick={() => handleReorder(room.id, 'up')} className="text-white/40 hover:text-white p-1" title="Move up">
                                ▲
                              </button>
                            )}
                            {idx < rooms.length - 1 && (
                              <button onClick={() => handleReorder(room.id, 'down')} className="text-white/40 hover:text-white p-1" title="Move down">
                                ▼
                              </button>
                            )}
                          </div>
                          <button onClick={() => setEditingRoom({ id: room.id, name: room.name, description: room.description })} className="p-1.5 text-white/40 hover:text-white">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-red-400/60 hover:text-red-400">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest name prompt */}
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
              <button onClick={saveGuestName} className="btn-primary flex-1 text-sm">
                OK
              </button>
              <button onClick={() => setShowNamePrompt(false)} className="btn-ghost flex-1 text-sm">
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-3 text-center font-myanmar">
              Login လုပ်ပါက နာမည်ကို automatically သုံးမည်
            </p>
          </div>
        </div>
      )}
    </div>
  )
}