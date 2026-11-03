import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useAuditLog() {
  const { user } = useAuth()

  /**
   * Log an action. Returns true when the audit row was written,
   * false when it failed (e.g. RLS — audit_logs INSERT is
   * admin/mod/super_admin only). Callers must check the return
   * value; a failed audit must never look like a success, but it
   * also never blocks the action itself.
   * @returns {Promise<boolean>}
   */
  async function log({ action, table, id, name, before = null, after = null, meta = {} }) {
    let changes = null
    if (before && after) {
      changes = {}
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
      for (const key of allKeys) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changes[key] = { before: before[key], after: after[key] }
        }
      }
      if (Object.keys(changes).length === 0) changes = null
    } else if (after) {
      changes = { _created: after }
    } else if (before) {
      changes = { _deleted: before }
    }

    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action,
        target_table: table,
        target_id: id || null,
        target_name: name || null,
        changes,
        meta,
      })
      if (error) {
        console.warn('Audit log failed:', error.message)
        return false
      }
      return true
    } catch (err) {
      // Non-blocking — log failure should never break the UI,
      // but the caller gets `false` so it is not silent success.
      console.warn('Audit log failed:', err)
      return false
    }
  }

  return { log }
}
