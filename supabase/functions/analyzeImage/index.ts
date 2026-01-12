import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const HIGH_CONFIDENCE_THRESHOLD = 0.80;

// Type definitions
interface AnalyzeImageRequest {
  imageUrl: string;
  imagePath: string;
}

interface ClarificationOption {
  id: string;
  label: string;
}

interface ClarificationData {
  question: string;
  options: ClarificationOption[];
}

interface AnalyzeImageResponse {
  mode: 'final' | 'clarify';
  confidence: number;
  label: string;
  clarification?: ClarificationData;
}

// Stub AI logic - This will be replaced with actual model/LLM integration
function analyzeImageStub(imageUrl: string): AnalyzeImageResponse {
  // Generate a random confidence score
  const confidence = Math.random();

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

  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    // High confidence - return final result
    return {
      mode: 'final',
      confidence: Number(confidence.toFixed(2)),
      label: randomCategory,
    };
  } else {
    // Low confidence - request clarification
    const clarificationOptions: ClarificationOption[] = [];

    // Generate 3-6 plausible options
    const numOptions = Math.floor(Math.random() * 4) + 3; // 3 to 6 options
    const shuffled = [...categories].sort(() => 0.5 - Math.random());

    for (let i = 0; i < Math.min(numOptions, shuffled.length); i++) {
      clarificationOptions.push({
        id: `option-${i + 1}`,
        label: shuffled[i],
      });
    }

    return {
      mode: 'clarify',
      confidence: Number(confidence.toFixed(2)),
      label: randomCategory,
      clarification: {
        question: 'We\'re not quite sure what this is. Can you help us out?',
        options: clarificationOptions,
      },
    };
  }
}

serve(async (req) => {
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

    // Return result
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in analyzeImage:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
