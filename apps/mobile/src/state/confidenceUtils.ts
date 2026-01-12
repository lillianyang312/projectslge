/**
 * Utility functions for confidence levels and UI colors
 */

import { ConfidenceLevel, getConfidenceLevel } from '../schemas/clarification_schema';

/**
 * Get color for confidence level (for UI display)
 */
export function getConfidenceColor(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case ConfidenceLevel.HIGH:
      return '#10B981'; // Green - high confidence
    case ConfidenceLevel.MEDIUM:
      return '#F59E0B'; // Amber - medium confidence
    case ConfidenceLevel.LOW:
      return '#EF4444'; // Red - low confidence
    default:
      return '#6B7280'; // Gray - unknown
  }
}

/**
 * Get color for confidence score (0.0 - 1.0)
 */
export function getConfidenceScoreColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return getConfidenceColor(level);
}

/**
 * Get label for confidence level
 */
export function getConfidenceLabel(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case ConfidenceLevel.HIGH:
      return 'High Confidence';
    case ConfidenceLevel.MEDIUM:
      return 'Medium Confidence';
    case ConfidenceLevel.LOW:
      return 'Low Confidence';
    default:
      return 'Unknown';
  }
}

