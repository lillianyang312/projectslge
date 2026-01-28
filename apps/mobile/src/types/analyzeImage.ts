/**
 * Type definitions for the analyzeImage Edge Function
 * UPDATED: Uses new clarification schema format (Phase 1 complete)
 */

export interface AnalyzeImageRequest {
  imageUrls: string[];
  imagePaths: string[];
  // Legacy single-image support
  imageUrl?: string;
  imagePath?: string;
}

export interface ClarificationOption {
  id: string;
  label: string;
  thumbnail?: string;
  descriptor: string;
}

// Category-specific details that can be extracted from images
export interface ClothingDetails {
  size?: string;           // e.g., "S", "M", "L", "XL", "32", "34W x 30L"
  clothingType?: string;   // e.g., "High-rise jeans", "Crop top", "Blazer"
  brand?: string;          // e.g., "Nike", "Levi's"
  color?: string;          // e.g., "Navy blue", "Black"
  material?: string;       // e.g., "Cotton", "Denim", "Polyester"
  gender?: string;         // e.g., "Men's", "Women's", "Unisex"
  style?: string;          // e.g., "Casual", "Formal", "Athletic"
}

export interface ElectronicsDetails {
  brand?: string;          // e.g., "Apple", "Samsung"
  model?: string;          // e.g., "iPhone 14 Pro", "Galaxy S23"
  storage?: string;        // e.g., "256GB", "1TB"
  color?: string;          // e.g., "Space Gray", "Silver"
  screenSize?: string;     // e.g., "6.1 inches", "27 inches"
  specs?: string;          // e.g., "16GB RAM, M2 chip"
}

export interface FurnitureDetails {
  material?: string;       // e.g., "Wood", "Metal", "Fabric"
  color?: string;          // e.g., "Walnut", "White"
  dimensions?: string;     // e.g., "72\" x 36\" x 30\""
  style?: string;          // e.g., "Modern", "Mid-century", "Industrial"
}

export interface BookDetails {
  author?: string;
  isbn?: string;
  edition?: string;
  publisher?: string;
  subject?: string;        // e.g., "Computer Science", "Biology"
}

export interface CategoryDetails {
  clothing?: ClothingDetails;
  electronics?: ElectronicsDetails;
  furniture?: FurnitureDetails;
  books?: BookDetails;
}

export interface IdentifiedItem {
  title: string;
  category: string;
  description?: string;
  condition?: string;
  tags?: string[];
  categoryDetails?: CategoryDetails;  // Category-specific extracted details
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
