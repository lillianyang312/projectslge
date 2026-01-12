/**
 * Type definitions for the analyzeImage Edge Function
 */

export interface AnalyzeImageRequest {
  imageUrl: string;
  imagePath: string;
}

export interface ClarificationOption {
  id: string;
  label: string;
}

export interface ClarificationData {
  question: string;
  options: ClarificationOption[];
}

export interface AnalyzeImageResponse {
  mode: 'final' | 'clarify';
  confidence: number;
  label: string;
  clarification?: ClarificationData;
}

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
 *   "mode": "final",
 *   "confidence": 0.92,
 *   "label": "furniture"
 * }
 */

/**
 * Sample response payload (low confidence - needs clarification):
 * {
 *   "mode": "clarify",
 *   "confidence": 0.65,
 *   "label": "electronics",
 *   "clarification": {
 *     "question": "We're not quite sure what this is. Can you help us out?",
 *     "options": [
 *       { "id": "option-1", "label": "laptop" },
 *       { "id": "option-2", "label": "tablet" },
 *       { "id": "option-3", "label": "phone" },
 *       { "id": "option-4", "label": "camera" }
 *     ]
 *   }
 * }
 */
