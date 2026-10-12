import * as Sentry from '@sentry/react';
/**
 * Initialize Sentry for error tracking
 * @param {string} dsn - Sentry DSN URL
 */
export const initErrorTracking = (dsn) => {
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 1.0,
      integrations: [new Sentry.Replay()],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
};

/**
 * Log error to Sentry and console
 * @param {Error} error - Error object
 * @param {string} context - Error context
 * @param {object} extra - Extra information
 */
export const logError = (error, context = '', extra = {}) => {
  console.error(`[${context}]`, error);

  Sentry.captureException(error, {
    tags: {
      context,
    },
    extra,
  });
};

/**
 * Handle API errors
 * @param {Error} error - Error from API call
 * @param {string} operation - Operation name
 * @returns {object} Formatted error object
 */
export const handleApiError = (error, operation = 'API Call') => {
  let message = 'အမှားအယွင်းတစ်ခု ဖြစ်ပေါ်ခဲ့သည်။';
  let code = 'UNKNOWN_ERROR';

  if (error.response) {
    // Server responded with error status
    code = error.response.status;
    message = error.response.data?.message || `Server Error: ${error.response.status}`;
  } else if (error.request) {
    // Request made but no response
    code = 'NO_RESPONSE';
    message = 'ကွန်ယက်ချိတ်ဆက်မှု ပြဿနာ ရှိသည်။';
  } else {
    // Error in request setup
    message = error.message || message;
  }

  logError(error, operation, { code, message });

  return { code, message, error };
};

/**
 * Handle Supabase errors
 * @param {Error} error - Error from Supabase
 * @param {string} operation - Operation name
 * @returns {object} Formatted error object
 */
export const handleSupabaseError = (error, operation = 'Database Operation') => {
  let message = 'ဒေတာဘေ့စ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့သည်။';
  let code = 'DB_ERROR';

  if (error.message) {
    message = error.message;

    if (error.message.includes('duplicate key')) {
      code = 'DUPLICATE_ENTRY';
      message = 'ဤအချက်အလက်သည် ရှိပြီးသားဖြစ်သည်။';
    } else if (error.message.includes('permission denied')) {
      code = 'PERMISSION_DENIED';
      message = 'ဤလုပ်ဆောင်ချက်ကို ပြုလုပ်ခွင့် မရှိသည်။';
    } else if (error.message.includes('not found')) {
      code = 'NOT_FOUND';
      message = 'ရှာဖွေတွေ့ရှိသော အချက်အလက် မရှိသည်။';
    }
  }

  logError(error, operation, { code, message });

  return { code, message, error };
};

// Note: ErrorBoundary component moved to src/components/ErrorBoundary.jsx
