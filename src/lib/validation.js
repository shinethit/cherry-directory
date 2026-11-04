/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const MYANMAR_DIGITS = '၀၁၂၃၄၅၆၇၈၉'

/** Convert Myanmar digits ၀-၉ to Latin 0-9 */
export const toLatinDigits = (value) => {
  if (value == null) return ''
  return String(value).replace(/[၀-၉]/g, d => MYANMAR_DIGITS.indexOf(d))
}

/** Canonical phone for comparison: Latin digits only, +95/0 prefix stripped */
export const normalizePhone = (phone) => {
  let p = toLatinDigits(phone || '').replace(/[\s\-()]/g, '')
  if (p.startsWith('+95')) p = p.slice(3)
  else if (p.startsWith('95')) p = p.slice(2)
  p = p.replace(/^0+/, '')
  return p
}

/**
 * Validate phone number format (Myanmar digits allowed)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const validatePhone = (phone) => {
  const latin = toLatinDigits(phone || '')
  const phoneRegex = /^[0-9\-\+\(\)\s]{7,}$/;
  return phoneRegex.test(latin);
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

  // Primary name is name_mm; English name alone is also fine. Myanmar-only
  // submissions must pass — never require data.name by itself.
  const hasName = (data.name_mm && data.name_mm.trim().length > 0) ||
    (data.name && data.name.trim().length > 0)
  if (!hasName) {
    errors.push('အမည် ထည့်သွင်းရန် လိုအပ်သည်။');
  }

  if (!data.category_id) {
    errors.push('အမျိုးအစား ရွေးချယ်ရန် လိုအပ်သည်။');
  }

  // Phones may be in form.phones[] (submit form) or phone_1/phone_2.
  const phones = Array.isArray(data.phones) ? data.phones : [data.phone_1, data.phone_2]
  for (const phone of phones) {
    if (phone && !validatePhone(phone)) {
      errors.push('ဖုန်းနံပါတ် မှားမှားမှားနေသည်။');
      break
    }
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
      name: data.name ? sanitizeInput(data.name) : data.name,
      name_mm: data.name_mm ? sanitizeInput(data.name_mm) : data.name_mm,
      description: data.description ? sanitizeInput(data.description) : data.description,
      address: data.address ? sanitizeInput(data.address) : data.address,
    },
  };
};
