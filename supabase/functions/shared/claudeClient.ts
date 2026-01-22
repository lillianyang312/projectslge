/**
 * Claude API Client for image analysis
 * Uses Claude Opus 4.5 with vision capabilities
 */

export interface ClaudeImageAnalysisResult {
  title: string;
  category: string;
  description?: string;
  condition?: string;
  tags?: string[];
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: Array<{
    id: string;
    label: string;
    descriptor: string;
  }>;
}

/**
 * Initialize Claude API client
 */
export function initializeClaudeClient(apiKey: string) {
  return {
    apiKey,
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-opus-4-5-20251101',
  };
}

/**
 * Fetch image and convert to base64
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.arrayBuffer();
    const bytes = new Uint8Array(blob);

    // Convert bytes to base64 without stack overflow for large images
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize)));
    }
    const base64 = btoa(binary);
    return base64;
  } catch (error) {
    throw new Error(`Error fetching image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze image using Claude Opus 4.5
 */
export async function analyzeImageWithClaude(
  imageUrl: string,
  apiKey: string
): Promise<ClaudeImageAnalysisResult> {
  if (!apiKey) {
    throw new Error('Claude API key is required');
  }

  if (!imageUrl) {
    throw new Error('Image URL is required');
  }

  try {
    // Fetch and convert image to base64
    const base64Image = await fetchImageAsBase64(imageUrl);

    // Determine image media type
    const imageMediaType = getImageMediaType(imageUrl);

    // Prepare the prompt for Claude
    const systemPrompt = `You are an expert item identification assistant. When shown an image, you must analyze it and provide structured information about the item.

Your response must be a valid JSON object matching this exact structure:
{
  "title": "specific name of the item",
  "category": "one of: furniture, electronics, clothing, books, kitchen, sports, toys, tools, other",
  "description": "brief description of what you see",
  "condition": "one of: like new, excellent, good, fair, poor",
  "tags": ["relevant", "tags", "describing", "the", "item"],
  "confidence": 0.0-1.0,
  "needsClarification": boolean,
  "clarificationQuestion": "optional question if clarification needed",
  "clarificationOptions": [
    {
      "id": "option-1",
      "label": "Category Name",
      "descriptor": "Description of what this option represents"
    }
  ]
}

Guidelines:
- confidence: How certain you are about the identification (0.0-1.0)
  - 0.85-1.0: High confidence - specific item clearly identifiable
  - 0.60-0.84: Medium confidence - could be one of several items
  - 0.0-0.59: Low confidence - unclear or needs clarification
- If confidence is 0.85+: needsClarification should be false, omit clarificationQuestion and clarificationOptions
- If confidence is 0.60-0.84: needsClarification should be true, provide 3-4 plausible alternatives in clarificationOptions
- If confidence is <0.60: needsClarification should be true, provide a question asking for clarification (options can be empty)
- Always return valid JSON only, no markdown formatting or code blocks`;

    const userPrompt = `Please analyze this item image and provide detailed identification information in the specified JSON format.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract the text content from Claude's response
    const textContent = data.content.find((block: { type: string }) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let analysisResult: ClaudeImageAnalysisResult;
    try {
      // Remove markdown code blocks if present
      let jsonString = textContent.text;
      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\n?/g, '');
      }
      analysisResult = JSON.parse(jsonString.trim());
    } catch (parseError) {
      throw new Error(`Failed to parse Claude's JSON response: ${textContent.text}`);
    }

    // Validate the response structure
    validateAnalysisResult(analysisResult);

    return analysisResult;
  } catch (error) {
    throw new Error(
      `Image analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Determine image media type from URL or default to jpeg
 */
function getImageMediaType(
  imageUrl: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const url = imageUrl.toLowerCase();
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.gif')) return 'image/gif';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Validate the analysis result structure
 */
function validateAnalysisResult(result: unknown): asserts result is ClaudeImageAnalysisResult {
  if (!result || typeof result !== 'object') {
    throw new Error('Analysis result must be an object');
  }

  const r = result as Record<string, unknown>;

  if (typeof r.title !== 'string' || !r.title) {
    throw new Error('title is required and must be a non-empty string');
  }

  if (typeof r.category !== 'string' || !r.category) {
    throw new Error('category is required and must be a non-empty string');
  }

  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    throw new Error('confidence must be a number between 0 and 1');
  }

  if (typeof r.needsClarification !== 'boolean') {
    throw new Error('needsClarification must be a boolean');
  }

  // Optional fields validation
  if (r.description !== undefined && typeof r.description !== 'string') {
    throw new Error('description must be a string if provided');
  }

  if (r.condition !== undefined && typeof r.condition !== 'string') {
    throw new Error('condition must be a string if provided');
  }

  if (r.tags !== undefined && !Array.isArray(r.tags)) {
    throw new Error('tags must be an array if provided');
  }

  if (
    r.clarificationQuestion !== undefined &&
    typeof r.clarificationQuestion !== 'string'
  ) {
    throw new Error('clarificationQuestion must be a string if provided');
  }

  if (r.clarificationOptions !== undefined && !Array.isArray(r.clarificationOptions)) {
    throw new Error('clarificationOptions must be an array if provided');
  }
}
