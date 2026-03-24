/**
 * Generate Cloudinary URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} Transformed URL
 */
export const getCloudinaryUrl = (publicId, options = {}) => {
  const {
    width = 800,
    height = null,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
    gravity = 'auto',
  } = options;

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';

  let transformation = `w_${width}`;

  if (height) {
    transformation += `,h_${height}`;
  }

  transformation += `,q_${quality},f_${format},c_${crop},g_${gravity}`;

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
};

/**
 * Generate responsive image srcset
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Options
 * @returns {string} Srcset string
 */
export const getResponsiveImageSrcset = (publicId, options = {}) => {
  const { quality = 'auto', format = 'auto' } = options;

  const sizes = [320, 640, 960, 1280, 1920];
  const srcset = sizes
    .map((width) => {
      const url = getCloudinaryUrl(publicId, {
        width,
        quality,
        format,
      });
      return `${url} ${width}w`;
    })
    .join(', ');

  return srcset;
};

/**
 * Generate responsive image sizes attribute
 * @returns {string} Sizes string
 */
export const getResponsiveImageSizes = () => {
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
};

/**
 * Optimize image for thumbnail
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Optimized URL
 */
export const getThumbnailUrl = (publicId) => {
  return getCloudinaryUrl(publicId, {
    width: 200,
    height: 200,
    crop: 'thumb',
    gravity: 'face',
    quality: 'auto',
    format: 'auto',
  });
};

/**
 * Optimize image for card display
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Optimized URL
 */
export const getCardImageUrl = (publicId) => {
  return getCloudinaryUrl(publicId, {
    width: 400,
    height: 300,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });
};

/**
 * Optimize image for full-width display
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Optimized URL
 */
export const getFullWidthImageUrl = (publicId) => {
  return getCloudinaryUrl(publicId, {
    width: 1200,
    height: 600,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });
};

/**
 * Get image with automatic quality and format
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - Image width
 * @returns {string} Optimized URL
 */
export const getOptimizedImageUrl = (publicId, width = 800) => {
  return getCloudinaryUrl(publicId, {
    width,
    quality: 'auto',
    format: 'auto',
  });
};

/**
 * Create lazy loading image component props
 * @param {string} publicId - Cloudinary public ID
 * @param {string} alt - Alt text
 * @param {object} options - Additional options
 * @returns {object} Image props
 */
export const getLazyImageProps = (publicId, alt = '', options = {}) => {
  const { width = 800, height = null } = options;

  return {
    src: getCloudinaryUrl(publicId, { width, height }),
    srcSet: getResponsiveImageSrcset(publicId),
    sizes: getResponsiveImageSizes(),
    alt,
    loading: 'lazy',
    decoding: 'async',
  };
};

/**
 * Preload image
 * @param {string} publicId - Cloudinary public ID
 */
export const preloadImage = (publicId) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getCloudinaryUrl(publicId, { width: 1200 });
  document.head.appendChild(link);
};
