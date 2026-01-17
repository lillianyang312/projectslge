import Anthropic from "@anthropic-ai/sdk";

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

/**
 * Request body for price estimation
 */
export interface EstimatePriceRequest {
  title: string;
  category: string;
  condition: string;
  description?: string;
  pricePurchased?: number;
  photoUrls?: string[];
}

/**
 * Response from price estimation
 */
export interface EstimatePriceResponse {
  market_value_min: number;
  market_value_max: number;
  confidence: number;
  reasoning: string;
  estimated_midpoint: number;
}

/**
 * Builds a detailed prompt for Claude to estimate item pricing
 */
function buildPricingPrompt(req: EstimatePriceRequest): string {
  const descriptionPart = req.description
    ? `\nItem Description: ${req.description}`
    : "";
  const pricePurchasedPart = req.pricePurchased
    ? `\nOriginal Purchase Price: $${req.pricePurchased}`
    : "";

  return `You are an expert marketplace pricing consultant. Analyze this item and provide a realistic market value estimate.

Item Details:
- Title: ${req.title}
- Category: ${req.category}
- Condition: ${req.condition}${descriptionPart}${pricePurchasedPart}

Based on current market conditions, comparable listings, and item condition, provide:
1. A realistic minimum price (floor)
2. A realistic maximum price (ceiling)
3. A confidence score (0.0-1.0) indicating how certain you are about this range

Consider:
- Current market demand for this item type
- Condition degradation from original price (if provided)
- Regional market variations (assume US average markets)
- Seasonality and timing factors
- Similar items selling on platforms like Facebook Marketplace, OfferUp, etc.

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "market_value_min": <number>,
  "market_value_max": <number>,
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief 1-2 sentence explanation of the valuation>"
}`;
}

async function handleEstimatePriceRequest(req: Request): Promise<Response> {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      console.error("❌ [estimatePrice] CLAUDE_API_KEY not set");
      return new Response(
        JSON.stringify({
          error: "CLAUDE_API_KEY is not set. Configure this secret in Supabase.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      console.error("❌ [estimatePrice] Failed to parse JSON body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON body in request." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const request = body as Partial<EstimatePriceRequest>;

    // Validate required fields
    if (!request.title || typeof request.title !== "string") {
      return new Response(
        JSON.stringify({
          error: "title is required and must be a string.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!request.category || typeof request.category !== "string") {
      return new Response(
        JSON.stringify({
          error: "category is required and must be a string.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!request.condition || typeof request.condition !== "string") {
      return new Response(
        JSON.stringify({
          error: "condition is required and must be a string.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("📥 [estimatePrice] Request received:", {
      title: request.title,
      category: request.category,
      condition: request.condition,
      hasDescription: !!request.description,
      hasPricePurchased: !!request.pricePurchased,
    });

    // Initialize Claude client
    const client = new Anthropic({ apiKey });

    // Build the pricing prompt
    const prompt = buildPricingPrompt(request as EstimatePriceRequest);

    console.log("🤖 [estimatePrice] Calling Claude API for pricing estimation");

    const startTime = Date.now();
    const response = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const duration = Date.now() - startTime;

    // Extract response text
    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    console.log("✨ [estimatePrice] Claude response received:", {
      duration: `${duration}ms`,
      responseLength: responseText.length,
    });

    // Parse Claude's JSON response
    let pricingData: {
      market_value_min: number;
      market_value_max: number;
      confidence: number;
      reasoning: string;
    };

    try {
      pricingData = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ [estimatePrice] Failed to parse Claude JSON response:", {
        response: responseText,
        error: e instanceof Error ? e.message : String(e),
      });
      return new Response(
        JSON.stringify({
          error: "Failed to parse pricing estimation from Claude.",
          details: responseText,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate pricing data
    if (
      typeof pricingData.market_value_min !== "number" ||
      typeof pricingData.market_value_max !== "number" ||
      typeof pricingData.confidence !== "number"
    ) {
      console.error("❌ [estimatePrice] Invalid pricing data format:", {
        pricingData,
      });
      return new Response(
        JSON.stringify({
          error:
            "Invalid pricing data format from Claude. Expected numeric values.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate ranges
    if (pricingData.market_value_min > pricingData.market_value_max) {
      console.warn("⚠️ [estimatePrice] Min price > max price, swapping", {
        original_min: pricingData.market_value_min,
        original_max: pricingData.market_value_max,
      });
      [pricingData.market_value_min, pricingData.market_value_max] = [
        pricingData.market_value_max,
        pricingData.market_value_min,
      ];
    }

    // Calculate midpoint
    const estimated_midpoint = Math.round(
      (pricingData.market_value_min + pricingData.market_value_max) / 2
    );

    const responseBody: EstimatePriceResponse = {
      market_value_min: Math.round(pricingData.market_value_min),
      market_value_max: Math.round(pricingData.market_value_max),
      confidence: Math.min(1, Math.max(0, pricingData.confidence)), // Clamp 0-1
      reasoning: pricingData.reasoning,
      estimated_midpoint,
    };

    console.log("💰 [estimatePrice] Pricing estimation complete:", responseBody);

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("❌ [estimatePrice] Error in pricing estimation function:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error during price estimation",
        details:
          error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// Only start the server if this is the main module
if (import.meta.main) {
  Deno.serve(handleEstimatePriceRequest);
}
