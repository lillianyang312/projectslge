import { createClient } from '@supabase/supabase-js';

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// Confidence thresholds matching clarification_schema.ts
const CONFIDENCE_THRESHOLDS = {
  HIGH_MIN: 0.85,
  MEDIUM_MIN: 0.60,
  LOW_MAX: 0.59,
} as const;

// Type definitions matching clarification_schema.ts
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

export type ClarificationResponse = IdentifiedResponse | NeedsClarificationResponse;

/**
 * Validate a clarification response
 * Exported for testing
 */
export function validateClarificationResponse(
  response: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate that response is an object
  if (!response || typeof response !== 'object') {
    errors.push('Response must be an object');
    return { valid: false, errors };
  }

  const r = response as Record<string, unknown>;

  // Validate type
  if (r.type !== 'identified' && r.type !== 'needs_clarification') {
    errors.push('Type must be either "identified" or "needs_clarification"');
    return { valid: false, errors };
  }

  // Validate confidence
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push('Confidence must be a number in range [0.0, 1.0]');
  }

  // Validate based on type
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
          if (opt.thumbnail !== undefined && typeof opt.thumbnail !== 'string') {
            errors.push(`Option at index ${index}: thumbnail must be a string if provided`);
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determine confidence level from numeric score
 * Exported for testing
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
 * Generate sample item data for a category
 */
function generateItemForCategory(category: string, confidence: number): IdentifiedItem {
  const itemTemplates: Record<string, Partial<IdentifiedItem>> = {
    furniture: {
      title: 'Office Chair',
      description: 'Ergonomic office chair with adjustable features',
      condition: 'Good',
      tags: ['chair', 'office', 'furniture'],
    },
    electronics: {
      title: 'Laptop',
      description: 'Portable computer device',
      condition: 'Like new',
      tags: ['laptop', 'computer', 'electronics'],
    },
    clothing: {
      title: 'T-Shirt',
      description: 'Casual cotton t-shirt',
      condition: 'Good',
      tags: ['clothing', 'shirt', 'casual'],
    },
    books: {
      title: 'Book',
      description: 'Paperback book',
      condition: 'Fair',
      tags: ['book', 'reading', 'literature'],
    },
    kitchen: {
      title: 'Kitchen Appliance',
      description: 'Kitchen utility item',
      condition: 'Good',
      tags: ['kitchen', 'appliance', 'cooking'],
    },
    sports: {
      title: 'Sports Equipment',
      description: 'Athletic gear',
      condition: 'Good',
      tags: ['sports', 'fitness', 'equipment'],
    },
    toys: {
      title: 'Toy',
      description: 'Children\'s play item',
      condition: 'Good',
      tags: ['toy', 'play', 'children'],
    },
    tools: {
      title: 'Tool',
      description: 'Hand or power tool',
      condition: 'Good',
      tags: ['tool', 'hardware', 'diy'],
    },
  };

  const template = itemTemplates[category.toLowerCase()] || {
    title: category.charAt(0).toUpperCase() + category.slice(1),
    description: `A ${category} item`,
    tags: [category.toLowerCase()],
  };

  return {
    title: template.title || category,
    category: category.charAt(0).toUpperCase() + category.slice(1),
    description: template.description,
    condition: template.condition,
    tags: template.tags,
  };
}

/**
 * Generate clarification options for medium confidence
 */
function generateClarificationOptions(
  categories: string[],
  preferredCount: number = 4
): ClarificationOption[] {
  const shuffled = [...categories].sort(() => 0.5 - Math.random());
  const count = Math.min(preferredCount, shuffled.length);
  const options: ClarificationOption[] = [];

  for (let i = 0; i < count; i++) {
    const category = shuffled[i];
    options.push({
      id: `option-${i + 1}`,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      descriptor: `A ${category} item that matches your photo`,
    });
  }

  return options;
}

/**
 * Stub AI logic - This will be replaced with actual model/LLM integration
 * Returns ClarificationResponse format matching clarification_schema.ts
 * Exported for testing
 */
export function analyzeImageStub(imageUrl: string): ClarificationResponse {
  // Generate a random confidence score
  const confidence = Number(Math.random().toFixed(2));

  // Sample categories for demonstration
  const categories = [
    'furniture',
    'electronics',
    'clothing',
    'books',
    'kitchen',
    'sports',
    'toys',
    'tools',
  ];

  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const confidenceLevel = getConfidenceLevel(confidence);

  if (confidenceLevel === 'high') {
    // High confidence (≥0.85) - return identified item
    const item = generateItemForCategory(randomCategory, confidence);
    return {
      type: 'identified',
      item,
      confidence,
    };
  } else if (confidenceLevel === 'medium') {
    // Medium confidence (0.60-0.84) - return options for selection
    const options = generateClarificationOptions(categories, 4);
    return {
      type: 'needs_clarification',
      question: 'Which item matches your photo?',
      options,
      confidence,
    };
  } else {
    // Low confidence (<0.60) - ask targeted question with empty options
    return {
      type: 'needs_clarification',
      question: 'What type of item is this? (e.g., furniture, electronics, clothing)',
      options: [],
      confidence,
    };
  }
}

// Only start the server if this is the main module (not imported for tests)
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
      // Parse request body
      const { imageUrl, imagePath }: AnalyzeImageRequest = await req.json();

      if (!imageUrl || !imagePath) {
        return new Response(
          JSON.stringify({ error: 'imageUrl and imagePath are required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      // Perform analysis (stub implementation)
      const result = analyzeImageStub(imageUrl);

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

      // Return validated result
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
