import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

/**
 * Optional context the caller can provide so the chatbot
 * can reference concrete marketplace objects from Supabase.
 */
export interface ChatbotContext {
  itemId?: string;
  dealId?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatbotRequest {
  /**
   * Optional system prompt that sets behavior / context.
   * If omitted, a default system prompt is used.
   */
  systemPrompt?: string;

  /**
   * The current user message to send to the LLM.
   * If conversationHistory is provided, this will be appended to it.
   */
  userMessage: string;

  /**
   * Optional conversation history as an array of messages.
   * If provided, the full conversation will be sent to the LLM.
   */
  conversationHistory?: ChatMessage[];

  /**
   * Optional context identifiers for pulling structured data
   * from Supabase (items, deals, etc.).
   */
  context?: ChatbotContext;
}

/**
 * Structured reference to a monetary amount that the
 * client UI can render as a pill. This is additive and
 * keeps the original `output` field for backwards compat.
 */
export interface PriceReference {
  kind:
    | "listing_price"
    | "buyer_bid"
    | "seller_counter"
    | "agreed_price"
    | "market_low"
    | "market_high"
    | "our_take";
  amount: number;
  currency: string;
  itemId?: string;
  dealId?: string;
}

export interface ChatbotResponse {
  /**
   * Raw text output from the LLM.
   */
  output: string;

  /**
   * Optional structured price references that the mobile
   * app can render as color–coded pill tags.
   */
  priceReferences?: PriceReference[];
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant for a marketplace app. " +
  "Answer clearly and concisely, focusing on helping the user understand how to list, find, and evaluate items.";

/**
 * Minimal row shapes for items and deals from the Supabase DB.
 * These are intentionally narrow to avoid tight coupling.
 */
export interface DbItemRow {
  id: string;
  label?: string;
  category?: string;
  market_value_min?: number | null;
  market_value_max?: number | null;
  user_min_price?: number | null;
  user_max_price?: number | null;
}

export interface DbDealRow {
  id: string;
  item_id: string;
  current_offer?: number | null;
  agreed_price?: number | null;
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    // We purposely don't hard–fail the entire function – if env
    // is missing we simply skip DB–backed context.
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

async function fetchDbContext(context?: ChatbotContext): Promise<{
  item?: DbItemRow;
  deal?: DbDealRow;
}> {
  if (!context) return {};

  const client = createServiceClient();
  if (!client) return {};

  const { itemId, dealId } = context;
  let item: DbItemRow | undefined;
  let deal: DbDealRow | undefined;

  if (dealId) {
    const { data } = await client
      .from("deals")
      .select("id, item_id, current_offer, agreed_price")
      .eq("id", dealId)
      .maybeSingle();
    if (data) {
      deal = data as DbDealRow;
    }
  }

  const resolvedItemId = itemId || deal?.item_id;
  if (resolvedItemId) {
    const { data } = await client
      .from("items")
      .select(
        "id, label, category, market_value_min, market_value_max, user_min_price, user_max_price",
      )
      .eq("id", resolvedItemId)
      .maybeSingle();
    if (data) {
      item = data as DbItemRow;
    }
  }

  return { item, deal };
}

/**
 * Build a summary string from item and deal context
 * Exported for testing
 */
export function buildDbContextSummary(item?: DbItemRow, deal?: DbDealRow): string {
  if (!item && !deal) return "";

  const parts: string[] = [];

  if (item) {
    const label = item.label || "this item";
    const category = item.category ? ` (${item.category})` : "";
    parts.push(`ITEM: ${label}${category}.`);

    if (item.market_value_min != null && item.market_value_max != null) {
      parts.push(
        `Estimated market value range is $${item.market_value_min} - $${item.market_value_max}.`,
      );
    }
    if (item.user_min_price != null) {
      parts.push(`Seller minimum price is $${item.user_min_price}.`);
    }
    if (item.user_max_price != null) {
      parts.push(`Buyer maximum price (if provided) is $${item.user_max_price}.`);
    }
  }

  if (deal) {
    if (deal.current_offer != null) {
      parts.push(`Current active offer is $${deal.current_offer}.`);
    }
    if (deal.agreed_price != null) {
      parts.push(`Agreed deal price (if any) is $${deal.agreed_price}.`);
    }
  }

  return parts.join(" ");
}

/**
 * Extract price references from LLM output
 * Exported for testing
 */
export function extractPriceReferencesFromOutput(
  output: string,
  item?: DbItemRow,
  deal?: DbDealRow,
): PriceReference[] {
  const references: PriceReference[] = [];
  if (!output) return references;

  function maybeAdd(
    kind: PriceReference["kind"],
    rawAmount: number | null | undefined,
    itemId?: string,
    dealId?: string,
  ) {
    if (rawAmount == null) return;
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) return;

    // Basic guard: only create a structured reference if the
    // exact numeric amount appears in the LLM output. This
    // prevents us from blessing hallucinated numbers.
    const amountPattern = new RegExp(`\\$?${amount}(\\.0+)?\\b`);
    if (!amountPattern.test(output)) return;

    references.push({
      kind,
      amount,
      currency: "USD",
      itemId,
      dealId,
    });
  }

  if (item) {
    maybeAdd("market_low", item.market_value_min, item.id);
    maybeAdd("market_high", item.market_value_max, item.id);
    maybeAdd("listing_price", item.user_min_price, item.id);
    maybeAdd("buyer_bid", item.user_max_price, item.id);
  }

  if (deal) {
    maybeAdd("buyer_bid", deal.current_offer, deal.item_id, deal.id);
    maybeAdd("agreed_price", deal.agreed_price, deal.item_id, deal.id);
  }

  return references;
}

/**
 * Handle chatbot request
 * Exported for testing
 */
export async function handleChatbotRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not set. Configure this secret in Supabase.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body in request." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const { systemPrompt, userMessage, conversationHistory, context } = body as Partial<
      ChatbotRequest
    >;

    if (!userMessage || typeof userMessage !== "string") {
      return new Response(
        JSON.stringify({
          error: "userMessage is required and must be a string.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const client = new OpenAI({ apiKey });

    // Fetch any referenced Supabase objects (items, deals) so we can
    // provide grounded numeric context to the LLM.
    const { item, deal } = await fetchDbContext(context);
    const dbContextSummary = buildDbContextSummary(item, deal);

    const baseSystemPrompt =
      systemPrompt && typeof systemPrompt === "string"
        ? systemPrompt
        : DEFAULT_SYSTEM_PROMPT;

    const pillTagGuidance = dbContextSummary
      ? "\n\nYou have access to structured marketplace context from the database:\n" +
        dbContextSummary +
        "\n\n" +
        "RULES FOR PRICES:\n" +
        "- Only talk about prices that come from this context or that the user explicitly mentions.\n" +
        "- When you mention a price from this context, keep the number grounded in those values.\n" +
        "- The client may parse monetary amounts like $120 and render them as pill tags.\n" +
        "- Be concise and avoid inventing additional numeric ranges that are not supported by the context."
      : "\n\nIf you mention any concrete prices, prefer round, realistic amounts and keep them internally consistent.";

    const finalSystemPrompt = baseSystemPrompt + pillTagGuidance;

    // Build messages array for OpenAI
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: finalSystemPrompt,
      },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Filter out system messages from history (we already have one)
      const historyMessages = conversationHistory.filter(
        (msg) => msg.role !== "system"
      );
      messages.push(...historyMessages);
    }

    // Add the current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
    });

    const output =
      completion.choices[0]?.message?.content?.toString().trim() ?? "";

    const priceReferences = extractPriceReferencesFromOutput(
      output,
      item,
      deal,
    );

    const responseBody: ChatbotResponse = {
      output,
      // Only include if non-empty to keep payload lean and backwards compatible.
      ...(priceReferences.length > 0 ? { priceReferences } : {}),
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in chatbot function:", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

// Only start the server if this is the main module (not imported for tests)
if (import.meta.main) {
  Deno.serve(handleChatbotRequest);
}


