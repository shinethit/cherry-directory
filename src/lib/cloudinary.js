const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadImage(file, folder = 'general') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', `cherry-directory/${folder}`)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
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