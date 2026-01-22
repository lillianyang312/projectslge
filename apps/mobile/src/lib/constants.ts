/**
 * Shared Confidence Thresholds
 * 
 * Centralized constants for confidence level categorization.
 * Used by both frontend (mobile app) and backend (Supabase Edge Functions).
 * 
 * These values are quantitative and adjustable for system scalability.
 * 
 * NOTE: This file should be kept in sync with supabase/functions/shared/constants.ts
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence score for high confidence category [0.85, 1.0] */
  HIGH_MIN: 0.85,
  /** Minimum confidence score for medium confidence category [0.60, 0.84] */
  MEDIUM_MIN: 0.60,
  /** Maximum confidence score for low confidence category [0.0, 0.59] */
  LOW_MAX: 0.59,
} as const;

/**
 * Browse / pagination
 */
export const BROWSE_PAGE_SIZE = 20;

export const INBOX_PAGE_SIZE = 20;

