/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const validatePhone = (phone) => {
  const phoneRegex = /^[0-9\-\+\(\)\s]{7,}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate listing data
 * @param {object} data - Listing data to validate
 * @returns {object} Validation result with errors array
 */
export const validateListing = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('အမည် ထည့်သွင်းရန် လိုအပ်သည်။');
  }

  if (!data.category_id) {
    errors.push('အမျိုးအစား ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  if (data.phone_1 && !validatePhone(data.phone_1)) {
    errors.push('ဖုန်းနံပါတ် မှားမှားမှားနေသည်။');
  }

  if (data.website && !validateUrl(data.website)) {
    errors.push('ဝဘ်ဆိုက် လိပ်စာ မှားမှားမှားနေသည်။');
  }

  if (data.latitude && (data.latitude < -90 || data.latitude > 90)) {
    errors.push('အနေအထားအတိုင်း (Latitude) မှားမှားမှားနေသည်။');
  }

  if (data.longitude && (data.longitude < -180 || data.longitude > 180)) {
    errors.push('အနေအထားအတိုင်း (Longitude) မှားမှားမှားနေသည်။');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate fuel report data
 * @param {object} data - Fuel report data to validate
 * @returns {object} Validation result with errors array
 */
export const validateFuelReport = (data) => {
  const errors = [];

  if (!data.station_id) {
    errors.push('ဆီဆိုင် ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  if (!data.fuel_type) {
    errors.push('ဆီအမျိုးအစား ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  if (!data.status || !['available', 'unavailable', 'limited'].includes(data.status)) {
    errors.push('ဆီအခြေအနေ မှားမှားမှားနေသည်။');
  }

  if (data.price && data.price < 0) {
    errors.push('စျေးနှုန်း အနုတ်မဖြစ်နိုင်ပါ။');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate review data
 * @param {object} data - Review data to validate
 * @returns {object} Validation result with errors array
 */
export const validateReview = (data) => {
  const errors = [];

  if (!data.listing_id) {
    errors.push('စာရင်း ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    errors.push('အဆင့်သတ်မှတ်မှု ၁ မှ ၅ အထိ ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  if (data.comment && data.comment.length > 1000) {
    errors.push('မှတ်ချက်သည် ၁၀၀၀ အက္ခရာထက် ကျော်လွန်၍ မရပါ။');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Validate and sanitize listing data
 * @param {object} data - Listing data to validate and sanitize
 * @returns {object} Validation result with sanitized data
 */
export const validateAndSanitizeListing = (data) => {
  const validation = validateListing(data);

  if (!validation.isValid) {
    return validation;
  }

  return {
    isValid: true,
    errors: [],
    data: {
      ...data,
      name: sanitizeInput(data.name),
      description: sanitizeInput(data.description),
      address: sanitizeInput(data.address),
    },
  };
};
