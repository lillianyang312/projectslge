import { colors } from '../ui/tokens';

export type DealStatus =
  | 'negotiating'
  | 'agreed'
  | 'logistics'
  | 'active'
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | string;

/**
 * Maps deal status → themed color used by components.
 * Default is "no color" (null) when status is unknown/unmapped.
 */
export const statusColorMap: Record<string, string> = {
  negotiating: colors.purple,
  pending: colors.purple,
  agreed: colors.success,
  logistics: colors.blue,
  scheduled: colors.blue,
  active: colors.warning,
};

export function getStatusColor(status?: DealStatus | null): string | null {
  if (!status) return null;
  return statusColorMap[String(status)] ?? null;
}

