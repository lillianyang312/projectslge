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

/**
 * Maps deal status → badge variant for UI components.
 * Returns badge variant string compatible with Badge component.
 */
export function getStatusBadgeVariant(status?: DealStatus | null): 'warning' | 'success' | 'purple' | 'neutral' {
  if (!status) return 'neutral';
  
  switch (status) {
    case 'pending': return 'purple';
    case 'negotiating': return 'purple';
    case 'agreed': return 'success';
    case 'logistics': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'neutral';
    default: return 'neutral';
  }
}

