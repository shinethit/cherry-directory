// Chat optimistic-send helpers (v9.20, D1).
//
// Problem: sendMessage used to rely on the realtime INSERT event
// (localhost only) or the next 20 s poll (live / proxied origin) to show
// the sender's own message, so on the live site a sent message took up
// to 20 s to appear. Fix: append the message locally immediately AFTER
// the insert succeeds (a failed insert never shows a phantom message),
// and dedupe by id so the later poll / realtime event cannot duplicate it.
//
// These helpers are pure so the append/dedupe logic is unit-testable;
// ChatPage.jsx wires them into sendMessage and the realtime handler.
// The 20 s poll does a full setMessages(rows) replace, so it needs no
// dedupe — it simply swaps the optimistic row for the server row.

/**
 * Build the local message object shown right after a successful insert.
 * Shaped like a row from the `select('*, user:profiles(...)')` load so
 * the message bubble renders identically (avatar initial, display name,
 * MMT time). `profile` is the sender's profiles row (full_name /
 * avatar_url); guests get `user: null` and render via guest_name.
 */
export function buildOptimisticMessage({ id, messageToSend, profile, createdAt = new Date().toISOString() }) {
  const loggedIn = Boolean(messageToSend?.user_id)
  return {
    id,
    room_id: messageToSend?.room_id ?? null,
    user_id: messageToSend?.user_id ?? null,
    guest_name: messageToSend?.guest_name ?? null,
    content: messageToSend?.content ?? '',
    reply_to: messageToSend?.reply_to ?? null,
    created_at: createdAt,
    user: loggedIn
      ? { full_name: profile?.full_name || null, avatar_url: profile?.avatar_url || null }
      : null,
  }
}

/**
 * Append a message to the list, ignoring it when an entry with the same
 * id is already present (the realtime INSERT event / a re-send arriving
 * after the optimistic append). Returns the previous array unchanged
 * when the id is already there.
 */
export function appendMessageDedup(prev, msg) {
  if (!msg || msg.id == null) return [...(prev || []), msg]
  const list = prev || []
  if (list.some(m => m && m.id === msg.id)) return list
  return [...list, msg]
}
