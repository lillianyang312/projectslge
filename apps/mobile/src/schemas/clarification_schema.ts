/**
 * Clarification Schema
 * 
 * Schema for multi-modal LLM item identification responses based on confidence levels.
 * Supports three confidence categories:
 * - High confidence: Suggest as placeholder (user can overwrite)
 * - Medium confidence: Present multiple options for user selection
 * - Low confidence: Ask targeted follow-up question, then repeat computation loop
 */

/**
 * Confidence threshold configuration
 * These values are quantitative and adjustable for system scalability
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
 * Maximum number of clarification iterations before fallback
 */
export const MAX_CLARIFICATION_ITERATIONS = 3;

/**
 * Confidence level categories
 */
export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Determine confidence level from a numeric confidence score
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH_MIN) {
    return ConfidenceLevel.HIGH;
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_MIN) {
    return ConfidenceLevel.MEDIUM;
  }
  return ConfidenceLevel.LOW;
}

/**
 * Option presented to user for medium confidence scenarios
 */
export type ClarificationOption = {
  /** Human-readable item name/title */
  label: string;
  /** Unique identifier for the option */
  id: string;
  /** Optional image URI or reference for thumbnail */
  thumbnail?: string;
  /** Short 1-2 sentence description */
  descriptor: string;
};

/**
 * Identified item data (matches core fields from OriginalListingData)
 */
export type IdentifiedItem = {
  /** Item title/name */
  title: string;
  /** Item category */
  category: string;
  /** Item description */
  description?: string;
  /** Condition of the item */
  condition?: string;
  /** Tags for searchability */
  tags?: string[];
};

/**
 * Response type when item is identified (high confidence or after selection)
 */
export type IdentifiedResponse = {
  type: 'identified';
  /** Identified item data */
  item: IdentifiedItem;
  /** Confidence score in range [0.0, 1.0] */
  confidence: number;
};

/**
 * Response type when clarification is needed (low or medium confidence)
 */
export type NeedsClarificationResponse = {
  type: 'needs_clarification';
  /** Targeted question for the user */
  question: string;
  /** Options for user selection (empty for low confidence, populated for medium confidence) */
  options: ClarificationOption[];
  /** Current confidence score in range [0.0, 1.0] */
  confidence: number;
};

/**
 * Union type for all clarification responses
 */
export type ClarificationResponse = IdentifiedResponse | NeedsClarificationResponse;

/**
 * Type guard to check if response is identified
 */
export function isIdentifiedResponse(
  response: ClarificationResponse
): response is IdentifiedResponse {
  return response.type === 'identified';
}

/**
 * Type guard to check if response needs clarification
 */
export function isNeedsClarificationResponse(
  response: ClarificationResponse
): response is NeedsClarificationResponse {
  return response.type === 'needs_clarification';
}

/**
 * Validation error for clarification schema
 */
export type ClarificationValidationError = {
  field: string;
  message: string;
};

/**
 * Validate a clarification response
 */
export function validateClarificationResponse(
  response: unknown
): ClarificationValidationError[] {
  const errors: ClarificationValidationError[] = [];

  if (!response || typeof response !== 'object') {
    errors.push({
      field: 'response',
      message: 'Response must be an object',
    });
    return errors;
  }

  const r = response as Record<string, unknown>;

  // Validate type field
  if (!r.type || (r.type !== 'identified' && r.type !== 'needs_clarification')) {
    errors.push({
      field: 'type',
      message: 'Type must be either "identified" or "needs_clarification"',
    });
    return errors;
  }

  // Validate confidence
  if (typeof r.confidence !== 'number') {
    errors.push({
      field: 'confidence',
      message: 'Confidence must be a number',
    });
  } else if (r.confidence < 0 || r.confidence > 1) {
    errors.push({
      field: 'confidence',
      message: 'Confidence must be in range [0.0, 1.0]',
    });
  }

  // Validate based on type
  if (r.type === 'identified') {
    if (!r.item || typeof r.item !== 'object') {
      errors.push({
        field: 'item',
        message: 'Item must be an object',
      });
    } else {
      const item = r.item as Record<string, unknown>;
      if (!item.title || typeof item.title !== 'string') {
        errors.push({
          field: 'item.title',
          message: 'Item title is required and must be a string',
        });
      }
      if (!item.category || typeof item.category !== 'string') {
        errors.push({
          field: 'item.category',
          message: 'Item category is required and must be a string',
        });
      }
      if (item.description !== undefined && typeof item.description !== 'string') {
        errors.push({
          field: 'item.description',
          message: 'Item description must be a string if provided',
        });
      }
      if (item.condition !== undefined && typeof item.condition !== 'string') {
        errors.push({
          field: 'item.condition',
          message: 'Item condition must be a string if provided',
        });
      }
      if (item.tags !== undefined && !Array.isArray(item.tags)) {
        errors.push({
          field: 'item.tags',
          message: 'Item tags must be an array if provided',
        });
      }
    }
  } else if (r.type === 'needs_clarification') {
    if (!r.question || typeof r.question !== 'string') {
      errors.push({
        field: 'question',
        message: 'Question is required and must be a string',
      });
    }
    if (!Array.isArray(r.options)) {
      errors.push({
        field: 'options',
        message: 'Options must be an array',
      });
    } else {
      r.options.forEach((option, index) => {
        if (!option || typeof option !== 'object') {
          errors.push({
            field: `options[${index}]`,
            message: 'Option must be an object',
          });
        } else {
          const opt = option as Record<string, unknown>;
          if (!opt.label || typeof opt.label !== 'string') {
            errors.push({
              field: `options[${index}].label`,
              message: 'Option label is required and must be a string',
            });
          }
          if (!opt.id || typeof opt.id !== 'string') {
            errors.push({
              field: `options[${index}].id`,
              message: 'Option id is required and must be a string',
            });
          }
          if (opt.thumbnail !== undefined && typeof opt.thumbnail !== 'string') {
            errors.push({
              field: `options[${index}].thumbnail`,
              message: 'Option thumbnail must be a string if provided',
            });
          }
          if (!opt.descriptor || typeof opt.descriptor !== 'string') {
            errors.push({
              field: `options[${index}].descriptor`,
              message: 'Option descriptor is required and must be a string',
            });
          }
        }
      });
    }
  }

  return errors;
}

/**
 * Validation result type
 */
export type ClarificationValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ClarificationValidationError[] };

/**
 * Safely validate a clarification response
 */
export function validateClarificationResponseSafe(
  response: unknown
): ClarificationValidationResult<ClarificationResponse> {
  const errors = validateClarificationResponse(response);
  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true, data: response as ClarificationResponse };
}

/**
 * Get the confidence level from a response
 */
export function getResponseConfidenceLevel(
  response: ClarificationResponse
): ConfidenceLevel {
  return getConfidenceLevel(response.confidence);
}

/**
 * Check if response has options (medium confidence scenario)
 */
export function hasOptions(response: NeedsClarificationResponse): boolean {
  return response.options.length > 0;
}

/**
 * Check if response needs a question (low confidence scenario)
 */
export function needsQuestion(response: NeedsClarificationResponse): boolean {
  return response.options.length === 0;
}

