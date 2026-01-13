/**
 * Type definitions for the analyzeImage Edge Function
 * UPDATED: Uses new clarification schema format (Phase 1 complete)
 */

export interface AnalyzeImageRequest {
  imageUrl: string;
  imagePath: string;
}

export interface ClarificationOption {
  id: string;
  label: string;
  thumbnail?: string;
  descriptor: string;
}

export interface IdentifiedItem {
  title: string;
  category: string;
  description?: string;
  condition?: string;
  tags?: string[];
}

export type IdentifiedResponse = {
  type: 'identified';
  item: IdentifiedItem;
  confidence: number;
};

export type NeedsClarificationResponse = {
  type: 'needs_clarification';
  question: string;
  options: ClarificationOption[];
  confidence: number;
};

export type AnalyzeImageResponse = IdentifiedResponse | NeedsClarificationResponse;

/**
 * Sample request payload:
 * {
 *   "imageUrl": "https://example.com/image.jpg",
 *   "imagePath": "user-123/1234567890.jpg"
 * }
 */

/**
 * Sample response payload (high confidence):
 * {
 *   "type": "identified",
 *   "item": {
 *     "title": "Office Chair",
 *     "category": "Furniture",
 *     "description": "Ergonomic office chair",
 *     "condition": "Good",
 *     "tags": ["chair", "office"]
 *   },
 *   "confidence": 0.92
 * }
 */

/**
 * Sample response payload (low confidence - needs clarification):
 * {
 *   "type": "needs_clarification",
 *   "question": "Which item matches your photo?",
 *   "options": [
 *     { "id": "option-1", "label": "Furniture", "descriptor": "A furniture item" },
 *     { "id": "option-2", "label": "Electronics", "descriptor": "An electronics item" },
 *     { "id": "option-3", "label": "Clothing", "descriptor": "A clothing item" },
 *     { "id": "option-4", "label": "Books", "descriptor": "A books item" }
 *   ],
 *   "confidence": 0.65
 * }
 */
