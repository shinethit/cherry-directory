import React, { useState } from 'react';
import { getLazyImageProps, getThumbnailUrl, getCardImageUrl } from '../lib/imageOptimization';

/**
 * Optimized Image Component with lazy loading and responsive images
 */
export const OptimizedImage = ({
  publicId,
  alt = '',
  className = '',
  imageType = 'card', // 'thumbnail', 'card', 'full-width'
  onLoad = null,
  onError = null,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  if (!publicId) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="text-gray-400 text-sm">No Image</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="text-gray-400 text-sm">Image Failed to Load</span>
      </div>
    );
  }

  let imageUrl;
  switch (imageType) {
    case 'thumbnail':
      imageUrl = getThumbnailUrl(publicId);
      break;
    case 'card':
      imageUrl = getCardImageUrl(publicId);
      break;
    case 'full-width':
      imageUrl = getCardImageUrl(publicId); // Use card size as default
      break;
    default:
      imageUrl = getCardImageUrl(publicId);
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <img
        {...getLazyImageProps(publicId, alt)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
};

export default OptimizedImage;
