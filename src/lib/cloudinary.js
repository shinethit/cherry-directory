const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const UPLOAD_TIMEOUT_MS = 30000

export async function uploadImage(file, folder = 'general') {
  // S33 (v9.17): client-side size (<=5 MB) + type (image/*) check and an
  // abort timeout — the old code sent any file and could hang forever.
  if (!file) throw new Error('Image upload failed')
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('ပုံဖိုင် (image) သာ တင်နိုင်ပါသည်')
  }
  if (file.size && file.size > MAX_IMAGE_BYTES) {
    throw new Error('ပုံ အများဆုံး 5MB သာ တင်နိုင်ပါသည်')
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', `cherry-directory/${folder}`)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
  let res
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData, signal: ctrl.signal }
    )
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error('Image upload failed')
  const data = await res.json()
  return data.secure_url
}

export function getOptimizedUrl(url, { width = 400, quality = 'auto', format = 'auto', dpr = 'auto' } = {}) {
  if (!url || !url.includes('cloudinary.com')) return url
  
  // Add dpr for retina displays
  const transformations = `w_${width},q_${quality},f_${format},dpr_${dpr}`
  return url.replace('/upload/', `/upload/${transformations}/`)
}

// Thumbnail for lists (smaller, faster)
export function getThumbnailUrl(url) {
  return getOptimizedUrl(url, { width: 150 })
}

// Card image for listings
export function getCardImageUrl(url) {
  return getOptimizedUrl(url, { width: 400 })
}

// Hero image for detail pages
export function getHeroImageUrl(url) {
  return getOptimizedUrl(url, { width: 800, quality: 'auto' })
}