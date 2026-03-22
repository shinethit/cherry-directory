import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useAuditLog() {
  const { user } = useAuth()

  /**
   * Log an action with optional before/after diff
   * @param {object} opts
   * @param {string} opts.action     - 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'bulk_import'
   * @param {string} opts.table      - target table name
   * @param {string} opts.id         - target record uuid
   * @param {string} opts.name       - human-readable label (e.g. listing name)
   * @param {object} opts.before     - snapshot before change { field: value }
   * @param {object} opts.after      - snapshot after change  { field: value }
   * @param {object} opts.meta       - extra context
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
      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action,
        target_table: table,
        target_id: id || null,
        target_name: name || null,
        changes,
        meta,
      })
    } catch (err) {
      // Non-blocking — log failure should never break the UI
      console.warn('Audit log failed:', err)
    }
  }

  return { log }
}
