/**
 * Utility helpers
 */

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Check if path is hidden (starts with dot)
 */
function isHidden(filePath) {
  return filePath.split('/').some(part => part.startsWith('.'));
}

/**
 * Sanitize filename for safe usage
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * Check if value is object
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Debounce function
 */
function debounce(func, wait, immediate) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate unique ID
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  formatBytes,
  formatNumber,
  getFileExtension,
  isHidden,
  sanitizeFilename,
  deepMerge,
  isObject,
  debounce,
  throttle,
  generateId,
  sleep
};
