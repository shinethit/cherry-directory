import { toast } from 'react-toastify';

/**
 * Show success notification
 * @param {string} message - Message to display
 */
export const showSuccess = (message) => {
  toast.success(message, {
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

/**
 * Show error notification
 * @param {string} message - Message to display
 */
export const showError = (message) => {
  toast.error(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

/**
 * Show info notification
 * @param {string} message - Message to display
 */
export const showInfo = (message) => {
  toast.info(message, {
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

/**
 * Show warning notification
 * @param {string} message - Message to display
 */
export const showWarning = (message) => {
  toast.warning(message, {
    position: 'top-right',
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

/**
 * Show loading notification
 * @param {string} message - Message to display
 * @returns {string} Toast ID for later update
 */
export const showLoading = (message) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

/**
 * Update loading notification
 * @param {string} toastId - Toast ID from showLoading
 * @param {object} options - Update options
 */
export const updateToast = (toastId, options) => {
  toast.update(toastId, {
    ...options,
    isLoading: false,
  });
};
