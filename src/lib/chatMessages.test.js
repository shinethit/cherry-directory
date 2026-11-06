import { describe, it, expect } from 'vitest'
import { buildOptimisticMessage, appendMessageDedup } from './chatMessages'

describe('chatMessages v9.20 (D1): optimistic send + dedupe by id', () => {
  const base = {
    room_id: 'room-1',
    user_id: 'user-1',
    guest_name: null,
    content: 'မင်္ဂလာပါ',
    reply_to: null,
  }

  it('builds a logged-in message shaped like a loaded row', () => {
    const msg = buildOptimisticMessage({
      id: 'm-1',
      messageToSend: base,
      profile: { full_name: 'Shine Thit', avatar_url: 'https://x/avatar.png' },
      createdAt: '2026-11-05T18:00:00.000Z',
    })
    expect(msg.id).toBe('m-1')
    expect(msg.room_id).toBe('room-1')
    expect(msg.user_id).toBe('user-1')
    expect(msg.content).toBe('မင်္ဂလာပါ')
    expect(msg.created_at).toBe('2026-11-05T18:00:00.000Z')
    expect(msg.user).toEqual({ full_name: 'Shine Thit', avatar_url: 'https://x/avatar.png' })
    expect(msg.reply_to).toBeNull()
  })

  it('builds a guest message with user null so it renders via guest_name', () => {
    const msg = buildOptimisticMessage({
      id: 'm-2',
      messageToSend: { ...base, user_id: null, guest_name: 'မောင်' },
      profile: null,
      createdAt: '2026-11-05T18:00:00.000Z',
    })
    expect(msg.user).toBeNull()
    expect(msg.guest_name).toBe('မောင်')
  })

  it('keeps reply_to so a reply renders its quote once the poll fills replyMap', () => {
    const msg = buildOptimisticMessage({
      id: 'm-3',
      messageToSend: { ...base, reply_to: 'm-0' },
      profile: { full_name: 'A', avatar_url: null },
    })
    expect(msg.reply_to).toBe('m-0')
  })

  it('appends a new message to the list', () => {
    const prev = [{ id: 'a' }, { id: 'b' }]
    const next = appendMessageDedup(prev, { id: 'c' })
    expect(next.map(m => m.id)).toEqual(['a', 'b', 'c'])
    expect(next).not.toBe(prev)
  })

  it('ignores a message whose id is already present (realtime echo after optimistic append)', () => {
    const prev = [{ id: 'a' }, { id: 'b' }]
    const next = appendMessageDedup(prev, { id: 'b', content: 'echo' })
    expect(next).toBe(prev)
    expect(next).toHaveLength(2)
  })

  it('does not duplicate when the poll returns the optimistic message (same id, server row)', () => {
    const optimistic = [{ id: 'm-1', content: 'မင်္ဂလာပါ' }]
    const serverEcho = { id: 'm-1', content: 'မင်္ဂလာပါ', created_at: '2026-11-05T18:00:01.000Z' }
    expect(appendMessageDedup(optimistic, serverEcho)).toBe(optimistic)
  })

  it('handles an empty previous list', () => {
    expect(appendMessageDedup([], { id: 'x' })).toEqual([{ id: 'x' }])
    expect(appendMessageDedup(null, { id: 'x' })).toEqual([{ id: 'x' }])
  })
})
