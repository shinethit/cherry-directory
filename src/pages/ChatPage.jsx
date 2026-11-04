import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Reply, X, Trash2, Plus, Pencil, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { usePoints } from '../hooks/usePoints'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { formatMMTTime } from '../lib/myanmarDate'

// Guest names that impersonate staff or the app itself are blocked.
const RESERVED_GUEST_NAME = /admin|moderator|staff|cherry/i
export function isReservedGuestName(name) {
  return RESERVED_GUEST_NAME.test(name || '')
}

function newGuestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function loadGuestMsgIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('guestMsgIds') || '[]'))
  } catch {
    return new Set()
  }
}

function ChatBubble({ msg, isMe, onReply, onDelete, canDelete, replyMap, lang }) {
  const quoted = msg.reply_to ? replyMap?.[msg.reply_to] : null
  return (
    <div className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          {(msg.user?.full_name || msg.guest_name || '?')[0]}
        </div>
      )}
      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <span className="text-[10px] text-white/60 mb-1 ml-1 font-display">
            {msg.user?.full_name || msg.guest_name || 'Guest'}
          </span>
        )}
        {msg.reply_to && (
          <div className={`text-[10px] text-white/60 mb-1 px-2 py-1 rounded-lg border-l-2 border-brand-400 bg-white/5 max-w-full ${isMe ? 'self-end' : ''}`}>
            {quoted ? (
              <>↩ <span className="text-brand-300 font-semibold">{quoted.user?.full_name || quoted.guest_name || 'Guest'}</span>: <span className="line-clamp-2">{quoted.content}</span></>
            ) : (
              <>↩ Reply</>
            )}
          </div>
        )}
        <div className={isMe ? 'bubble-me' : 'bubble-other'}>
          <p className="text-sm text-white font-myanmar leading-relaxed">{msg.content}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-white/60">
            {formatMMTTime(msg.created_at, lang)}
          </span>
          <button onClick={() => onReply(msg)} className="text-xs text-white/60 hover:text-brand-300 transition-colors flex items-center justify-center gap-0.5 px-3 py-3 min-h-[44px] min-w-[44px]">
            <Reply size={12} /> Reply
          </button>
          {canDelete && (
            <button onClick={() => onDelete(msg.id)} className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center justify-center gap-0.5 px-3 py-3 min-h-[44px] min-w-[44px]">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user, profile, isLoggedIn, isAdmin, isModerator } = useAuth()
  const { lang } = useLang()
  const { award } = usePoints()
  const location = useLocation()
  // F11: a notification tap navigates here with state.roomId — open that
  // room instead of the first one. Consumed once on the first rooms load.
  const pendingRoomIdRef = useRef(location.state?.roomId || null)
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [guestName, setGuestName] = useState(localStorage.getItem('guestName') || '')
  const [replyTo, setReplyTo] = useState(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [replyMap, setReplyMap] = useState({})
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Guest identity (G-L2): chat_messages has no guest_id column, so a
  // guest's own messages are scoped by the ids THIS device sent (kept in
  // localStorage, so they survive reloads) — not by the display name,
  // which any other guest can reuse. Messages sent before this guest id
  // existed fall back to the name match so a returning guest's history
  // does not suddenly render as someone else's. A guest_id column
  // (Track 5 SQL) would make this fully robust.
  const guestIdCreatedAt = useRef(Number(localStorage.getItem('guestIdCreatedAt') || 0))
  const myGuestMsgIds = useRef(loadGuestMsgIds())

  function rememberGuestMessage(id) {
    if (!id) return
    myGuestMsgIds.current.add(id)
    try {
      localStorage.setItem('guestMsgIds', JSON.stringify([...myGuestMsgIds.current].slice(-200)))
    } catch { /* storage full / private mode — scoping just degrades to name match */ }
  }

  function isMyGuestMessage(msg) {
    if (msg.guest_name !== guestName) return false
    if (myGuestMsgIds.current.has(msg.id)) return true
    // Legacy fallback: sent before this device had a guest id.
    if (guestIdCreatedAt.current && new Date(msg.created_at).getTime() < guestIdCreatedAt.current) return true
    return false
  }

  // Room management state
  const [showRoomManager, setShowRoomManager] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [newRoomType, setNewRoomType] = useState('group')
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [roomsError, setRoomsError] = useState(false)

  // Load rooms
  const loadRooms = async () => {
    setRoomsError(false)
    try {
      // chat_rooms has no sort_order column — order by created_at.
      // 30 s timeout (was none): a hung query left the room list
      // empty with no error and no retry.
      const { data, error } = await withTimeout(supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: true }), 30000, 'Chat rooms')
      if (error) throw error
      setRooms(data || [])
      // F11: honour the notification's roomId on first load; otherwise
      // keep the old behaviour (first room).
      const targetId = pendingRoomIdRef.current
      pendingRoomIdRef.current = null
      const target = targetId ? (data || []).find(r => r.id === targetId) : null
      if (target) setActiveRoom(target)
      else if (data?.length && !activeRoom) setActiveRoom(data[0])
    } catch (err) {
      console.error('loadRooms error:', err)
      setRoomsError(true)
      showError('Rooms ရယူရာတွင် အမှားရှိသည်: ' + err.message)
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

    // Initial load — fetch the NEWEST 100, then reverse for display
    // (oldest-first order + limit(100) used to return the oldest 100).
    const loadMessages = async () => {
      try {
        // 30 s timeout (was none): a hung query left the room showing
        // no messages with no error; realtime still delivers new ones.
        const { data, error } = await withTimeout(supabase
          .from('chat_messages')
          .select('*, user:profiles(full_name, avatar_url)')
          .eq('room_id', activeRoom.id)
          .order('created_at', { ascending: false })
          .limit(100), 30000, 'Chat messages')
        if (error) throw error
        const rows = (data || []).reverse()
        if (isSubscribed) {
          setMessages(rows)
          // Fetch quoted (replied-to) messages so replies show text + author.
          const replyIds = [...new Set(rows.map(m => m.reply_to).filter(Boolean))]
          if (replyIds.length) {
            const { data: quoted } = await supabase
              .from('chat_messages')
              .select('id, content, guest_name, user:profiles(full_name)')
              .in('id', replyIds)
            if (quoted) {
              const map = {}
              quoted.forEach(q => { map[q.id] = q })
              if (isSubscribed) setReplyMap(map)
            }
          }
        }
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
            if (newMsg.reply_to) {
              const { data: quoted } = await supabase
                .from('chat_messages')
                .select('id, content, guest_name, user:profiles(full_name)')
                .eq('id', newMsg.reply_to)
                .single()
              if (quoted) setReplyMap(prev => ({ ...prev, [quoted.id]: quoted }))
            }
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
    // In-flight guard: a double-tap used to double-post (G-M6).
    if (sending) return

    if (!isLoggedIn && !guestName) {
      setShowNamePrompt(true)
      return
    }

    // Guests must not impersonate staff or the app itself.
    if (!isLoggedIn && isReservedGuestName(guestName)) {
      showError('ဒီနာမည် သုံးလို့မရပါ — တခြားနာမည် ရွေးပါ')
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

    setSending(true)
    try {
      // .select('id') records the sent message's id so the guest's own
      // messages can be scoped to this device (G-L2).
      const { data: inserted, error } = await supabase.from('chat_messages').insert(messageToSend).select('id').single()
      if (error) throw error
      if (!isLoggedIn) rememberGuestMessage(inserted?.id)
      // Clear the input ONLY after a successful insert — clearing first
      // loses the typed message forever when offline.
      setInput('')
      setReplyTo(null)
      // Logged-in users earn +1 chat point per message (max 10/day — the
      // cap is enforced server-side by award_chat_point(); a points
      // failure never blocks chat).
      if (isLoggedIn) award({ action: 'chat_message' })
    } catch (err) {
      console.error('Send error:', err)
      showError('မက်ဆေ့ ပို့ရာတွင် အမှားရှိသည်: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!(await confirmDialog('ဖျက်မည်လား?', { danger: true }))) return
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', messageId)
      if (error) throw error
      // Optimistic update: remove from local state immediately
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err) {
      console.error('Delete error:', err)
      showError('ဖျက်ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  const saveGuestName = () => {
    const name = guestName.trim()
    if (!name) return
    // Guests must not impersonate staff or the app itself.
    if (isReservedGuestName(name)) {
      showError('ဒီနာမည် သုံးလို့မရပါ — တခြားနာမည် ရွေးပါ')
      return
    }
    localStorage.setItem('guestName', name)
    // First time this device picks a guest name, mint its stable guest id
    // (G-L2) — messages from before this moment keep the legacy
    // name-match fallback (see isMyGuestMessage).
    if (!localStorage.getItem('guestId')) {
      localStorage.setItem('guestId', newGuestId())
      const now = Date.now()
      localStorage.setItem('guestIdCreatedAt', String(now))
      guestIdCreatedAt.current = now
    }
    setShowNamePrompt(false)
    // The name prompt was opened because the user tried to send — send
    // the pending input now instead of dropping it (G-M6).
    if (input.trim()) sendMessage()
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
      const { error } = await supabase.from('chat_rooms').insert({
        name: newRoomName.trim(),
        description: newRoomDesc.trim() || null,
        type: newRoomType,
        is_active: true,
      })
      if (error) throw error
      setNewRoomName('')
      setNewRoomDesc('')
      setNewRoomType('group')
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
    if (!(await confirmDialog('ဒီ Room ကို ဖျက်မည်လား? အတွင်းက မက်ဆေ့များပါ ဖျက်မည်။', { danger: true }))) return
    try {
      const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId)
      if (error) throw error
      if (activeRoom?.id === roomId) setActiveRoom(null)
      await loadRooms()
    } catch (err) {
      console.error('Delete room error:', err)
      showError('ဖျက်ရာတွင် အမှားရှိသည်: ' + err.message)
    }
  }

  // Room Manager modal — defined once so it is reachable from the
  // empty state too (the early return used to hide it entirely).
  const roomManagerModal = (
    <>
            {showRoomManager && (isAdmin || isModerator) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowRoomManager(false)}>
          <div className="bg-[#1a0030] rounded-2xl w-full max-w-md border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
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
                  className="input-dark"
                />
                <input
                  type="text"
                  placeholder="ဖော်ပြချက် (optional)"
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  className="input-dark"
                />
                {/* Room type (D17): Group / Private — stored in chat_rooms.type */}
                <div>
                  <p className="text-xs text-white/50 mb-1.5">အခန်းအမျိုးအစား</p>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="အခန်းအမျိုးအစား">
                    <button
                      type="button"
                      onClick={() => setNewRoomType('group')}
                      aria-pressed={newRoomType === 'group'}
                      className={`min-h-[44px] rounded-xl text-sm font-semibold border transition-colors ${newRoomType === 'group' ? 'bg-brand-600/60 text-brand-200 border-brand-400/40' : 'text-white/50 border-white/10 hover:text-white/80'}`}
                    >
                      အဖွဲ့
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoomType('private')}
                      aria-pressed={newRoomType === 'private'}
                      className={`min-h-[44px] rounded-xl text-sm font-semibold border transition-colors ${newRoomType === 'private' ? 'bg-brand-600/60 text-brand-200 border-brand-400/40' : 'text-white/50 border-white/10 hover:text-white/80'}`}
                    >
                      တစ်ဦးချင်း
                    </button>
                  </div>
                </div>
                <button onClick={handleCreateRoom} className="w-full btn-primary text-sm py-3 min-h-[44px] flex items-center justify-center gap-1">
                  <Plus size={14} /> အခန်းသစ်ထည့်မည်
                </button>
              </div>

              {/* Existing rooms */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                {rooms.map((room) => (
                  <div key={room.id} className="bg-white/5 rounded-xl p-3">
                    {editingRoom?.id === room.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingRoom.name}
                          onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })}
                          className="input-dark w-full"
                        />
                        <input
                          type="text"
                          value={editingRoom.description || ''}
                          onChange={e => setEditingRoom({ ...editingRoom, description: e.target.value })}
                          className="input-dark w-full"
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
                          <p className="text-white font-semibold flex items-center gap-2 flex-wrap">
                            {room.name}
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                              {room.type === 'private' ? 'တစ်ဦးချင်း' : 'အဖွဲ့'}
                            </span>
                          </p>
                          {room.description && <p className="text-xs text-white/50">{room.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
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
    </>
  )

  if (rooms.length === 0) {
    return (
      <>
      <div className="flex items-center justify-center h-[80dvh] p-4 text-center">
        <div className="card-dark p-6 rounded-2xl max-w-sm">
          <span className="text-4xl mb-3 block">💬</span>
          {roomsError ? (
            <>
              <p className="text-red-400 font-myanmar mb-3">တင်မရပါ — ပြန်ကြိုးစားမည်</p>
              <button onClick={loadRooms} className="btn-primary text-sm px-4 py-3 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
            </>
          ) : (
            <>
              <p className="text-white/70 font-myanmar">Chat room မရှိသေးပါ။</p>
              {(isAdmin || isModerator) && (
                <button onClick={() => setShowRoomManager(true)} className="btn-primary text-sm px-4 py-3 min-h-[44px] mt-3">
                  Room အသစ်ဖန်တီးမည်
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {roomManagerModal}
    </>
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
            isMe={isLoggedIn ? msg.user_id === user?.id : isMyGuestMessage(msg)}
            onReply={setReplyTo}
            onDelete={deleteMessage}
            canDelete={canDelete(msg)}
            replyMap={replyMap}
            lang={lang}
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
          <p className="text-[10px] text-white/60 mb-1.5">
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
            className="input-dark flex-1 py-2 font-myanmar"
            style={{ fontSize: '16px' }}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-brand-600 disabled:opacity-40 hover:bg-brand-500 transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {roomManagerModal}

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
            <p className="text-[10px] text-white/60 mt-3 text-center font-myanmar">
              Login လုပ်ပါက နာမည်ကို automatically သုံးမည်
            </p>
          </div>
        </div>
      )}
    </div>
  )
}