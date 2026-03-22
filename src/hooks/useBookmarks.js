import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useBookmarks() {
  const { user, isLoggedIn } = useAuth()
  const [bookmarks, setBookmarks] = useState(new Set()) // Set of "type:id" strings
  const [loading, setLoading] = useState(false)

  const loadBookmarks = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    const { data } = await supabase
      .from('bookmarks')
      .select('target_type, target_id')
      .eq('user_id', user.id)
    if (data) {
      setBookmarks(new Set(data.map(b => `${b.target_type}:${b.target_id}`)))
    }
    setLoading(false)
  }, [user, isLoggedIn])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  function isBookmarked(type, id) {
    return bookmarks.has(`${type}:${id}`)
  }

  async function toggleBookmark(type, id) {
    if (!isLoggedIn) return false
    const key = `${type}:${id}`
    if (bookmarks.has(key)) {
      // Remove
      setBookmarks(prev => { const n = new Set(prev); n.delete(key); return n })
      await supabase.from('bookmarks').delete().match({ user_id: user.id, target_type: type, target_id: id })
    } else {
      // Add
      setBookmarks(prev => new Set([...prev, key]))
      await supabase.from('bookmarks').insert({ user_id: user.id, target_type: type, target_id: id })
    }
    return true
  }

  async function fetchBookmarkedListings() {
    if (!isLoggedIn) return []
    const { data: bmarks } = await supabase.from('bookmarks').select('target_id').eq('user_id', user.id).eq('target_type', 'listing')
    if (!bmarks?.length) return []
    const ids = bmarks.map(b => b.target_id)
    const { data } = await supabase.from('listings').select('*, category:categories(name, name_mm, icon)').in('id', ids)
    return data || []
  }

  async function fetchBookmarkedPosts() {
    if (!isLoggedIn) return []
    const { data: bmarks } = await supabase.from('bookmarks').select('target_id').eq('user_id', user.id).eq('target_type', 'post')
    if (!bmarks?.length) return []
    const ids = bmarks.map(b => b.target_id)
    const { data } = await supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm)').in('id', ids)
    return data || []
  }

  return { isBookmarked, toggleBookmark, fetchBookmarkedListings, fetchBookmarkedPosts, bookmarkCount: bookmarks.size, loading }
}
