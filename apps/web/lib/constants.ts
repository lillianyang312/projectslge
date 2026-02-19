export const CONFIDENCE_THRESHOLDS = {
  HIGH_MIN: 0.85,
  MEDIUM_MIN: 0.60,
  LOW_MAX: 0.59,
} as const;

export const BROWSE_PAGE_SIZE = 20;
export const INBOX_PAGE_SIZE = 20;

export const SUPABASE_STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
