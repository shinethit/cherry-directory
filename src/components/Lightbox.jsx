import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getOptimizedUrl } from '../lib/cloudinary'

export default function Lightbox({ images, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [images.length, onClose])

  const currentImage = images[currentIndex] ? getOptimizedUrl(images[currentIndex], { width: 1200 }) : null

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
        <X size={24} className="text-white" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => Math.max(0, i - 1)); }}
            className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30"
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => Math.min(images.length - 1, i + 1)); }}
            className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30"
            disabled={currentIndex === images.length - 1}
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        </>
      )}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {currentImage && <img src={currentImage} alt="" className="max-w-full max-h-[90vh] object-contain" />}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}