/**
 * PDF Extraction Types
 * Defines request/response formats for senior sale PDF extraction
 */

export interface PDFExtractionRequest {
  pdfPath: string; // Path in Supabase Storage (e.g., 'user-123/sale.pdf')
  userId: string;
  options?: {
    extractMetadata?: boolean;
    analyzeImages?: boolean;
  };
}

/**
 * Intermediate format for extracted item data
 * Before mapping to the full Item schema
 */
export interface ExtractedItem {
  title: string;
  description: string;
  price?: number;
  imageUrls?: string[]; // URLs/paths of item images
  imagePaths?: string[]; // Storage paths of uploaded images
  isSold?: boolean;
  category?: string;
  condition?: string;
  rawText?: string; // Original text from PDF
}

/**
 * Final extracted item mapped to Item schema
 */
export interface ExtractedItemOutput {
  title: string;
  category: string;
  description: string;
  photos: string[]; // Storage paths
  user_min_price?: number;
  user_max_price?: number;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  isSold?: boolean;
  confidence?: number;
}

export interface PDFExtractionResponse {
  success: boolean;
  items: ExtractedItemOutput[];
  errors?: string[];
  metadata?: {
    totalPages: number;
    totalItems: number;
    extractedAt: string;
  };
}
