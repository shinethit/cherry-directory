import { useEffect } from 'react'

const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://cherry-directory.vercel.app'
const SITE_NAME = 'Cherry Directory — တောင်ကြီး'

export function useSEO({ title, description, image, url, type = 'website' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    const fullDesc = description || 'တောင်ကြီးမြို့ ၏ Business Directory — ဆိုင်များ၊ သတင်းများ၊ ဖြစ်ရပ်များ'
    const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL
    const fullImage = image || `${BASE_URL}/og-default.png`

    // Basic
    document.title = fullTitle
    setMeta('description', fullDesc)

    // Open Graph
    setOG('og:title', fullTitle)
    setOG('og:description', fullDesc)
    setOG('og:url', fullUrl)
    setOG('og:image', fullImage)
    setOG('og:type', type)
    setOG('og:site_name', SITE_NAME)
    setOG('og:locale', 'my_MM')

    // Twitter card
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', fullDesc)
    setMeta('twitter:image', fullImage)

    return () => {
      document.title = SITE_NAME
    }
  }, [title, description, image, url, type])
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setOG(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
