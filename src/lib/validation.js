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
  // M2 (v9.17): the old regex accepted any 7+ chars from [0-9-+() ] —
  // '-------' and '   ' passed with zero digits. Strip to digits after
  // toLatinDigits and require 7–15 digits.
  const digits = toLatinDigits(phone || '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export const validateUrl = (url) => {
  // S21 (v9.17): require an http:/https: scheme — new URL('javascript:...')
  // parses fine, so the old check accepted javascript: URLs.
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
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

  // M1 (v9.17): NaN is not < -90 and not > 90, so a NaN coordinate used
  // to pass the range check and JSON-serialize to null (erasing the pin).
  // Reject non-finite coordinates explicitly.
  if (data.latitude != null && data.latitude !== '' && !Number.isFinite(Number(data.latitude))) {
    errors.push('အနေအထားအတိုင်း (Latitude) မှားမှားမှားနေသည်။');
  } else if (data.latitude && (data.latitude < -90 || data.latitude > 90)) {
    errors.push('အနေအထားအတိုင်း (Latitude) မှားမှားမှားနေသည်။');
  }

  if (data.longitude != null && data.longitude !== '' && !Number.isFinite(Number(data.longitude))) {
    errors.push('အနေအထားအတိုင်း (Longitude) မှားမှားမှားနေသည်။');
  } else if (data.longitude && (data.longitude < -180 || data.longitude > 180)) {
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
