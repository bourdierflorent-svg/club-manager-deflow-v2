/**
 * UTILS - Point d'entrée centralisé
 * Fresh Touch Optimization - Day 1
 * 
 * Usage: import { formatCurrency, CHART_COLORS, generateShortId } from '../utils';
 */

// Formatters
export { 
  formatCurrency, 
  formatDate, 
  formatTime, 
  formatTableNumber 
} from './formatters';

// Constants
export { 
  CHART_COLORS, 
  CHART_TOOLTIP_STYLE, 
  EXCEL_DEFAULT_COLUMNS,
  BOTTLE_SIZES,
  TABLE_TYPES,
  ERROR_MESSAGES,
  CONFIRM_MESSAGES,
  SUCCESS_MESSAGES
} from './constants';

export type { BottleSize } from './constants';

// Helpers
export {
  generateShortId,
  generateOrderId,
  generateItemId,
  generateManualId,
  aggregateEventData,
  calculateItemsTotal,
  isBarTable,
  getTableZone,
  truncateText,
  debounce,
  // Stats calculations
  calculateWaiterStats,
  calculatePromoterStats,
  calculateArchiveWaiterStats,
  filterWaiterTables,
} from './helpers';

// Types from helpers
export type {
  WaiterStat,
  PromoterStat,
  AggregatedClientData,
} from './helpers';

// Security
export {
  // Rate limiting
  canAttemptLogin,
  recordFailedAttempt,
  resetLoginAttempts,
  // Session management
  createSession,
  getSession,
  updateSessionActivity,
  clearSession,
  getSessionTimeRemaining,
  // Validation & Sanitization
  sanitizeString,
  sanitizeForDisplay,
  validateName,
  validatePhone,
  validateNote,
  validatePin,
  validateAmount,
  // Encryption
  encryptData,
  decryptData,
  hashData,
  // Utilities
  generateSecureId,
  isProduction,
  secureLog,
  secureError,
} from './security';

export { writeVisitToHub } from './hubVisitWriter';
export { createHubCustomerAuto } from './hubCustomerCreator';
export { createHubApporteurAuto } from './hubApporteurCreator';
