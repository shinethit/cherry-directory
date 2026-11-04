/**
 * Imperative confirm dialog — callable from anywhere.
 *
 * Usage:
 *   if (!(await confirmDialog('Delete?'))) return
 *   if (!(await confirmDialog({ message: 'Delete?', danger: true }))) return
 *   // H9: `danger: true` (alias: `destructive: true`) shows the red
 *   // confirm button; without it the confirm button is btn-primary.
 *   // Pass danger ONLY for delete/destructive confirms.
 */
import { openConfirm } from '../components/ConfirmModal'

export function confirmDialog(message, options = {}) {
  if (typeof message === 'object') {
    return openConfirm(message)
  }
  return openConfirm({ message, ...options })
}

export default confirmDialog
