import Anthropic from "@anthropic-ai/sdk";
import { CONFIDENCE_THRESHOLDS } from '../shared/constants.ts';

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// Type definitions matching clarification_schema.ts
export interface AnalyzeImageRequest {
  imageUrls: string[];  // Support multiple images
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

export type ClarificationResponse = IdentifiedResponse | NeedsClarificationResponse;

/**
 * Validate a clarification response
 * Exported for testing
 */
export function validateClarificationResponse(
  response: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response must be an object');
    return { valid: false, errors };
  }

  const r = response as Record<string, unknown>;

  if (r.type !== 'identified' && r.type !== 'needs_clarification') {
    errors.push('Type must be either "identified" or "needs_clarification"');
    return { valid: false, errors };
  }

  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push('Confidence must be a number in range [0.0, 1.0]');
  }

  if (r.type === 'identified') {
    if (!r.item || typeof r.item !== 'object') {
      errors.push('Item must be an object');
    } else {
      const item = r.item as Record<string, unknown>;
      if (!item.title || typeof item.title !== 'string') {
        errors.push('Item title is required and must be a string');
      }
      if (!item.category || typeof item.category !== 'string') {
        errors.push('Item category is required and must be a string');
      }
      if (item.description !== undefined && typeof item.description !== 'string') {
        errors.push('Item description must be a string if provided');
      }
      if (item.condition !== undefined && typeof item.condition !== 'string') {
        errors.push('Item condition must be a string if provided');
      }
      if (item.tags !== undefined && !Array.isArray(item.tags)) {
        errors.push('Item tags must be an array if provided');
      }
    }
  } else if (r.type === 'needs_clarification') {
    if (!r.question || typeof r.question !== 'string') {
      errors.push('Question is required and must be a string');
    }
    if (!Array.isArray(r.options)) {
      errors.push('Options must be an array');
    } else {
      r.options.forEach((option, index) => {
        if (!option || typeof option !== 'object') {
          errors.push(`Option at index ${index} must be an object`);
        } else {
          const opt = option as Record<string, unknown>;
          if (!opt.label || typeof opt.label !== 'string') {
            errors.push(`Option at index ${index}: label is required and must be a string`);
          }
          if (!opt.id || typeof opt.id !== 'string') {
            errors.push(`Option at index ${index}: id is required and must be a string`);
          }
          if (!opt.descriptor || typeof opt.descriptor !== 'string') {
            errors.push(`Option at index ${index}: descriptor is required and must be a string`);
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determine confidence level from numeric score
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH_MIN) {
    return 'high';
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_MIN) {
    return 'medium';
  }
  return 'low';
}

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    console.log(`📸 Fetching image from: ${url.substring(0, 100)}...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // Map content type to supported media types
    let mediaType = 'image/jpeg';
    if (contentType.includes('png')) {
      mediaType = 'image/png';
    } else if (contentType.includes('gif')) {
      mediaType = 'image/gif';
    } else if (contentType.includes('webp')) {
      mediaType = 'image/webp';
    }

    console.log(`✅ Image fetched successfully: ${mediaType}, ${base64.length} chars`);
    return { base64, mediaType };
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

/**
 * Analyze images using Claude Vision API
 */
async function analyzeWithClaude(imageUrls: string[]): Promise<ClarificationResponse> {
  const apiKey = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey) {
    console.error('❌ No CLAUDE_API_KEY or ANTHROPIC_API_KEY found');
    throw new Error('Claude API key not configured');
  }

  console.log(`🤖 Analyzing ${imageUrls.length} image(s) with Claude Vision...`);

  const client = new Anthropic({ apiKey });

  // Fetch all images and convert to base64
  const imageContents: Anthropic.ImageBlockParam[] = [];

  for (const url of imageUrls) {
    const imageData = await fetchImageAsBase64(url);
    if (imageData) {
      imageContents.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageData.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: imageData.base64,
        },
      });
    }
  }

  if (imageContents.length === 0) {
    console.error('❌ No images could be fetched');
    throw new Error('Failed to fetch any images');
  }

  const systemPrompt = `You are an expert at identifying items for a marketplace listing.
Analyze the provided image(s) and identify the item being shown.

${imageContents.length > 1 ? `You have been provided ${imageContents.length} images of the SAME item from different angles. Use ALL images together to get a complete understanding of the item, including details that may only be visible in certain photos.` : 'Analyze this single image carefully.'}

**CRITICAL: TEXT EXTRACTION**
Carefully examine the image(s) for ANY visible text including:
- Brand names, logos, and labels
- Size tags and labels (look for S, M, L, XL, or numeric sizes like "32", "34W x 30L")
- Care labels with material composition (e.g., "100% Cotton", "60% Polyester")
- Model numbers and product codes
- Price tags or retail tags
- ISBN numbers on books
- Any printed text on the item itself

Read and extract ALL visible text to populate the categoryDetails fields accurately.

You MUST respond with valid JSON in one of these two formats:

FORMAT 1 - When you can confidently identify the item:
{
  "type": "identified",
  "item": {
    "title": "Specific item name (e.g., 'Apple MacBook Pro 14-inch 2023' or 'IKEA MALM 6-drawer dresser')",
    "category": "Category (e.g., 'Electronics', 'Furniture', 'Clothing', 'Kitchen', 'Sports', 'Books', 'Toys', 'Tools', 'Home Decor', 'Collectibles')",
    "description": "Detailed description including brand, model, color, size, material, and notable features visible in the image(s)",
    "condition": "Condition based on visible wear (New, Like New, Good, Fair, Poor)",
    "tags": ["relevant", "search", "tags"],
    "categoryDetails": {
      // Include ONLY the relevant category object based on item category
      // For Clothing items:
      "clothing": {
        "size": "EXACT size from label/tag (S, M, L, XL, 32, 34W x 30L, etc.) - READ THE TAG",
        "clothingType": "Specific type (e.g., 'High-rise skinny jeans', 'Oversized hoodie', 'Fitted blazer')",
        "brand": "Brand name from label/logo - READ ANY VISIBLE BRANDING",
        "color": "Color(s)",
        "material": "Material ONLY - a clean value like 'Cotton', 'Denim', 'Polyester', 'Silk', 'Wool', 'Linen'. Do NOT add parenthetical notes like '(estimated)' or '(likely)'. Just the material name.",
        "gender": "Men's, Women's, or Unisex",
        "style": "Style (Casual, Formal, Athletic, Streetwear, etc.)"
      },
      // For Electronics items:
      "electronics": {
        "brand": "Brand from logo/label (Apple, Samsung, Sony, etc.)",
        "model": "EXACT model number/name if visible on device or packaging",
        "storage": "Storage capacity from label if visible",
        "color": "Color variant",
        "screenSize": "Screen size if visible on specs label",
        "specs": "Any specs visible on labels (RAM, processor, etc.)"
      },
      // For Furniture items:
      "furniture": {
        "material": "Primary material - clean value only like 'Wood', 'Metal', 'Fabric'. No parenthetical notes.",
        "color": "Color/finish",
        "dimensions": "Approximate dimensions if estimable",
        "style": "Style (Modern, Mid-century, Industrial, etc.)"
      },
      // For Books items:
      "books": {
        "author": "Author name from cover/spine - READ THE TEXT",
        "isbn": "ISBN number if visible on barcode area",
        "edition": "Edition if visible",
        "publisher": "Publisher if visible",
        "subject": "Subject area (Computer Science, Fiction, etc.)"
      }
    }
  },
  "confidence": 0.95
}

FORMAT 2 - When the item is unclear or you need more information:
{
  "type": "needs_clarification",
  "question": "A specific question to help identify the item",
  "options": [
    {"id": "1", "label": "Option 1", "descriptor": "Description of this option"},
    {"id": "2", "label": "Option 2", "descriptor": "Description of this option"},
    {"id": "3", "label": "Option 3", "descriptor": "Description of this option"}
  ],
  "confidence": 0.5
}

IMPORTANT RULES:
- **ALWAYS READ TEXT IN THE IMAGE** - Look for labels, tags, logos, printed text
- Be SPECIFIC with titles - include brand, model, size when visible
- **ALWAYS FILL categoryDetails** - You MUST include the relevant category object with ALL fields populated
- For clothing, ALWAYS fill clothingType (e.g., "Bottoms", "Tops", "Dresses", "Outerwear", "Shoes"), brand (if visible or inferable), size (ALWAYS infer from visual cues or tags - use S/M/L/XL format), and material (infer from visual appearance if no label)
- For clothing, clothingType should match one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Bags, Jewelry, Watches, Other accessories
- For clothing, ALWAYS check for size tags/labels - they're usually on the inside collar, waistband, or a sewn-in tag
- For clothing, read care labels for material composition (usually lists percentages)
- For clothing, identify the specific type (high-rise, low-rise, crop, oversized, fitted, etc.) in the clothingType field
- For electronics, ALWAYS fill brand (even if estimated from design), model if visible
- For electronics, look for model numbers on the device, box, or settings screen
- For furniture, identify brand (IKEA, West Elm, etc.) and style
- For books, READ the cover and spine for title, author, and publisher
- Even if you cannot SEE a label, make your best inference for fields like clothingType, brand, material based on visual appearance. NEVER add qualifiers like '(estimated)', '(likely)', '(appears to be)', or parenthetical notes to any field value. Just provide the clean value.
- Only include the relevant category object in categoryDetails (e.g., only "clothing" for clothing items)
- If you can read text but can't make it out clearly, still include your best interpretation
- Confidence should be 0.85+ when you're certain of the identification
- Confidence should be 0.60-0.84 when reasonably confident but not certain
- Confidence should be below 0.60 when the item is unclear
- ONLY output valid JSON, no other text`;

  const userContent: Anthropic.ContentBlockParam[] = [
    ...imageContents,
    {
      type: 'text',
      text: imageContents.length > 1
        ? `Please analyze these ${imageContents.length} images of the same item and provide a detailed identification for a marketplace listing. Consider all angles and details visible across all photos.`
        : 'Please analyze this image and provide a detailed identification for a marketplace listing.',
    },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      system: systemPrompt,
    });

    console.log('📝 Claude response received');

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const responseText = textContent.text.trim();
    console.log('📄 Raw response:', responseText.substring(0, 500));

    // Parse JSON response
    // Handle case where response might be wrapped in markdown code blocks
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr) as ClarificationResponse;

    // Validate the response
    const validation = validateClarificationResponse(result);
    if (!validation.valid) {
      console.error('❌ Invalid response format:', validation.errors);
      throw new Error(`Invalid response format: ${validation.errors.join(', ')}`);
    }

    console.log(`✅ Analysis complete: ${result.type}, confidence: ${result.confidence}`);
    return result;

  } catch (error) {
    console.error('❌ Error calling Claude API:', error);
    throw error;
  }
}

/**
 * Fallback stub for when Claude API is unavailable
 */
function analyzeImageStub(): ClarificationResponse {
  return {
    type: 'needs_clarification',
    question: 'Unable to analyze image automatically. What type of item is this?',
    options: [
      { id: '1', label: 'Electronics', descriptor: 'Phones, computers, gadgets, etc.' },
      { id: '2', label: 'Furniture', descriptor: 'Tables, chairs, shelves, etc.' },
      { id: '3', label: 'Clothing', descriptor: 'Shirts, pants, shoes, etc.' },
      { id: '4', label: 'Other', descriptor: 'Something else' },
    ],
    confidence: 0.0,
  };
}

// Only start the server if this is the main module
if (import.meta.main) {
  Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    try {
      const body: AnalyzeImageRequest = await req.json();

      // Support both single image (legacy) and multiple images
      let imageUrls: string[] = [];

      if (body.imageUrls && body.imageUrls.length > 0) {
        imageUrls = body.imageUrls;
      } else if (body.imageUrl) {
        imageUrls = [body.imageUrl];
      }

      if (imageUrls.length === 0) {
        return new Response(
          JSON.stringify({ error: 'At least one imageUrl is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      console.log(`🖼️ Received request to analyze ${imageUrls.length} image(s)`);

      let result: ClarificationResponse;

      try {
        result = await analyzeWithClaude(imageUrls);
      } catch (error) {
        console.error('⚠️ Claude analysis failed, using fallback:', error);
        result = analyzeImageStub();
      }

      // Validate response against schema
      const validation = validateClarificationResponse(result);
      if (!validation.valid) {
        console.error('Response validation failed:', validation.errors);
        return new Response(
          JSON.stringify({
            error: 'Internal server error: Invalid response format',
            details: validation.errors,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      });
    } catch (error) {
      console.error('Error in analyzeImage:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: errorMessage }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  });
}
