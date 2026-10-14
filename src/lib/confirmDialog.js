/**
 * Imperative confirm dialog — callable from anywhere.
 *
 * Usage:
 *   if (!(await confirmDialog('Delete?'))) return
 *   if (!(await confirmDialog({ message: 'Delete?', destructive: true }))) return
 */
import { openConfirm } from '../components/ConfirmModal'

export function confirmDialog(message, options = {}) {
  if (typeof message === 'object') {
    return openConfirm(message)
  }
  return openConfirm({ message, ...options })
}

export default confirmDialog
