// Phone helpers — v0.9.1.
// Guests see a masked number; logged-in users see the full number and get
// working tel:/WhatsApp links. Never render a guest's full phone as a link.

import { toLatinDigits } from './validation'

// Myanmar digits ၀-၉ are stripped by \D, so convert to Latin first —
// otherwise toTelHref('၀၉…') returns '' and the Call/WhatsApp link is dead.
const digitsOnly = (phone) => toLatinDigits(phone).replace(/\D/g, '')

// Myanmar numbers: "09..." → international form without the leading 0.
// Any other leading 0 (e.g. a Taunggyi landline 081-…) also drops the 0
// and gains the 95 country code — otherwise tel:+081… / wa.me/081… is invalid.
export function toIntlDigits(phone) {
  const d = digitsOnly(phone)
  if (d.startsWith('959')) return d
  if (d.startsWith('09')) return `95${d.slice(1)}`
  if (d.startsWith('0')) return `95${d.slice(1)}`
  return d
}

// Guests: "091 ••• ••• 89". Logged-in: full number as typed.
export function maskPhone(phone, isLoggedIn) {
  if (!phone) return ''
  if (isLoggedIn) return String(phone)
  const d = digitsOnly(phone)
  if (d.length <= 5) return '••• ••• ••'
  return `${d.slice(0, 3)} ••• ••• ${d.slice(-2)}`
}

// tel: link that dials correctly (uses +95 international format).
export function toTelHref(phone) {
  const d = toIntlDigits(phone)
  return d ? `tel:+${d}` : ''
}

// wa.me needs the country code WITHOUT '+' and WITHOUT the leading 0.
export function toWaHref(phone, text = '') {
  const d = toIntlDigits(phone)
  if (!d) return ''
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${d}${q}`
}
