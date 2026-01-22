// @deno-types="npm:@anthropic-ai/sdk"
import Anthropic from "@anthropic-ai/sdk";
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

  /**
   * Optional deal updates extracted from agent response.
   * Client can use this to update local state immediately.
   */
  dealUpdates?: DealUpdate;

  /**
   * Whether a deal was updated in the database.
   */
  dealUpdated?: boolean;

  /**
   * Action type that requires user input (e.g., accept_offer, finalize).
   * Client can use this to show appropriate UI buttons.
   */
  actionNeeded?: ActionNeededType;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant for a marketplace app. " +
  "Answer clearly and concisely, focusing on helping the user understand how to list, find, and evaluate items.";

/**
 * Agent-mediated three-way chat system prompt.
 * The agent facilitates communication between buyer and seller,
 * extracts key negotiation details, and minimizes direct back-and-forth.
 */
export const MEDIATOR_SYSTEM_PROMPT = `You are an AI marketplace agent mediating between a buyer and seller. Your job is to facilitate smooth transactions with minimal direct messaging between parties.

NEGOTIATION STAGES:
The deal progresses through these stages in order:
1. NEGOTIATING - Price discussion (offer, counter-offer, acceptance)
2. AGREED - Both parties accept a price, ready for finalization
3. LOGISTICS - After finalization, coordinate pickup/delivery details
4. COMPLETED - Pickup confirmed, transaction done

AUTO-ANSWER OBVIOUS QUESTIONS:
When a buyer asks questions about the item that are ALREADY in the item context data you have, answer directly without bothering the seller:
- "What condition is it in?" → Answer from the Condition field
- "What category is this?" → Answer from the Category field
- "How much is it?" / "What's the price?" → Provide the estimated value range
- "Any notes/details about it?" → Share the item notes if available
- "What's the lowest you'll accept?" → Only share if seller has set a minimum price

Only forward questions to the seller if:
- The question is NOT answered by the available item data
- The question requires the seller's subjective opinion
- The question is about something specific not in the listing

COMPETITIVE BIDDING - PROMPT TO RAISE OFFERS:
When you detect COMPETING OFFERS in the context:
- If the buyer's offer is EQUAL TO OR LOWER than the highest competing offer, actively encourage them to raise their bid
- Say something like: "Just so you know, there's already an offer of $X on this item. You might want to consider offering more to increase your chances!"
- If their offer is HIGHER than all competing offers, congratulate them: "Great news - your offer of $X is currently the highest bid!"
- When a new higher offer comes in, proactively notify other buyers: "Heads up! Someone just offered $X for this item. Would you like to raise your offer?"

CRITICAL INFORMATION TO TRACK:
For BOTH buyer AND seller, always ensure they know:
- Current offer amount (who offered what)
- Payment method (cash, Venmo, etc.)
- Any changes to price or terms

PROACTIVE PROMPTING - You MUST ask for missing info:
- No price mentioned? → "What price would you like to offer/accept?"
- Price accepted but no payment method? → "How would you like to handle payment? (Cash, Venmo, etc.)"
- In logistics but no timing? → "What days/times work for pickup?"
- In logistics but no location? → "Where should the pickup happen?"

WHEN TO SUGGEST FINALIZATION:
When BOTH conditions are met:
1. A price has been accepted by both parties
2. Payment method is agreed

Tell them: "Both parties have agreed on $X with [payment method]. You can now finalize the deal using the 'Finalize' button. Once finalized, we'll coordinate pickup details."

LOGISTICS COORDINATION (after finalization):
1. Ask seller for available pickup times (suggest 2-3 options)
2. Present options to buyer
3. If no match, let them propose alternatives
4. Once timing agreed, confirm location
5. Summarize final pickup details to both parties

RESPONSE FORMAT:
Always include a structured tag at the END when deal state changes:

For new offers:
[DEAL_UPDATE: offer=$XXX, status=negotiating]

For accepted price (ready to finalize):
[DEAL_UPDATE: agreed_price=$XXX, status=agreed, payment_method="cash"]

For logistics updates:
[DEAL_UPDATE: status=logistics, pickup_date=YYYY-MM-DD, pickup_time="3pm", pickup_location="123 Main St"]

For completion:
[DEAL_UPDATE: status=completed]

Also include action prompts when user input is needed:
[ACTION_NEEDED: type=accept_offer|counter_offer|confirm_pickup|finalize]

Example negotiation response:
"The buyer has offered $500 for your item (asking price was $550).

Would you like to:
• Accept $500
• Counter with a different price
• Decline the offer

[DEAL_UPDATE: offer=$500, status=negotiating]
[ACTION_NEEDED: type=accept_offer]"

Example logistics response:
"Great, the deal is finalized at $550! Now let's coordinate pickup.

Seller, what times work for you this week? I'll suggest some options:
• Saturday 2-4pm
• Sunday 11am-1pm
• Monday after 5pm

[DEAL_UPDATE: status=logistics]
[ACTION_NEEDED: type=confirm_pickup]"

Be concise and action-oriented. Guide users toward completing the transaction efficiently.`;

/**
 * Minimal row shapes for items and deals from the Supabase DB.
 * These are intentionally narrow to avoid tight coupling.
 */
export interface DbItemRow {
  id: string;
  label?: string;
  title?: string;
  category?: string;
  condition?: string;
  notes?: string;
  description?: string;
  market_value_min?: number | null;
  market_value_max?: number | null;
  user_min_price?: number | null;
  user_max_price?: number | null;
  estimated_value_min?: number | null;
  estimated_value_max?: number | null;
}

export interface CompetingOffer {
  dealId: string;
  buyerId: string;
  currentOffer: number | null;
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
  competingOffers?: CompetingOffer[];
}> {
  if (!context) return {};

  const client = createServiceClient();
  if (!client) return {};

  const { itemId, dealId } = context;
  let item: DbItemRow | undefined;
  let deal: DbDealRow | undefined;
  let competingOffers: CompetingOffer[] = [];

  if (dealId) {
    const { data } = await client
      .from("deals")
      .select("id, item_id, current_offer, agreed_price, buyer_id")
      .eq("id", dealId)
      .maybeSingle();
    if (data) {
      deal = data as DbDealRow;
    }
  }

  const resolvedItemId = itemId || deal?.item_id;
  if (resolvedItemId) {
    // Fetch item with more details for auto-answering questions
    const { data } = await client
      .from("items")
      .select(
        "id, title, label, category, condition, notes, estimated_value_min, estimated_value_max, market_value_min, market_value_max, user_min_price, user_max_price",
      )
      .eq("id", resolvedItemId)
      .maybeSingle();
    if (data) {
      item = data as DbItemRow;
    }

    // Fetch competing offers on the same item (for prompting to raise bids)
    const { data: otherDeals } = await client
      .from("deals")
      .select("id, buyer_id, current_offer")
      .eq("item_id", resolvedItemId)
      .eq("status", "negotiating")
      .not("id", "eq", dealId || "");

    if (otherDeals) {
      competingOffers = otherDeals.map((d) => ({
        dealId: d.id,
        buyerId: d.buyer_id,
        currentOffer: d.current_offer,
      }));
    }
  }

  return { item, deal, competingOffers };
}

/**
 * Build a summary string from item and deal context
 * Exported for testing
 */
export function buildDbContextSummary(item?: DbItemRow, deal?: DbDealRow, competingOffers?: CompetingOffer[]): string {
  if (!item && !deal) return "";

  const parts: string[] = [];

  if (item) {
    const title = item.title || item.label || "this item";
    const category = item.category ? ` (Category: ${item.category})` : "";
    const condition = item.condition ? ` Condition: ${item.condition}.` : "";
    parts.push(`ITEM: "${title}"${category}.${condition}`);

    // Include notes/description for auto-answering questions
    if (item.notes) {
      parts.push(`Item notes: ${item.notes}`);
    }

    const minValue = item.estimated_value_min || item.market_value_min;
    const maxValue = item.estimated_value_max || item.market_value_max;
    if (minValue != null && maxValue != null) {
      parts.push(
        `Estimated market value range is $${minValue} - $${maxValue}.`,
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

  // Include competing offers info for prompting bid raises
  if (competingOffers && competingOffers.length > 0) {
    const activeOffers = competingOffers.filter((o) => o.currentOffer != null);
    if (activeOffers.length > 0) {
      const highestOffer = Math.max(...activeOffers.map((o) => o.currentOffer!));
      parts.push(`COMPETING OFFERS: There are ${competingOffers.length} other interested buyers.`);
      parts.push(`The highest competing offer on this item is $${highestOffer}.`);
    } else {
      parts.push(`OTHER INTEREST: ${competingOffers.length} other buyer(s) have expressed interest but haven't made offers yet.`);
    }
  }

  return parts.join(" ");
}

/**
 * Action types that require user input
 */
export type ActionNeededType = 'accept_offer' | 'counter_offer' | 'confirm_pickup' | 'finalize' | 'provide_payment' | 'suggest_times';

/**
 * Interface for deal updates extracted from agent response
 */
export interface DealUpdate {
  offer?: number;
  agreed_price?: number;
  status?: 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled';
  payment_method?: string;
  pickup_date?: string;
  pickup_time?: string;
  pickup_location?: string;
  delivery_method?: 'pickup' | 'shipping';
}

/**
 * Parse deal updates from agent response
 * Looks for [DEAL_UPDATE: ...] tags in the output
 */
export function parseDealUpdates(output: string): DealUpdate | null {
  const dealUpdateMatch = output.match(/\[DEAL_UPDATE:\s*([^\]]+)\]/i);
  if (!dealUpdateMatch) return null;

  const updateStr = dealUpdateMatch[1];
  const update: DealUpdate = {};

  // Parse offer amount
  const offerMatch = updateStr.match(/offer=\$?(\d+(?:\.\d{2})?)/i);
  if (offerMatch) {
    update.offer = parseFloat(offerMatch[1]);
  }

  // Parse agreed price
  const agreedMatch = updateStr.match(/agreed_price=\$?(\d+(?:\.\d{2})?)/i);
  if (agreedMatch) {
    update.agreed_price = parseFloat(agreedMatch[1]);
  }

  // Parse status
  const statusMatch = updateStr.match(/status=(negotiating|agreed|logistics|completed|cancelled)/i);
  if (statusMatch) {
    update.status = statusMatch[1].toLowerCase() as DealUpdate['status'];
  }

  // Parse payment method
  const paymentMatch = updateStr.match(/payment_method="([^"]+)"/i);
  if (paymentMatch) {
    update.payment_method = paymentMatch[1];
  }

  // Parse pickup date
  const dateMatch = updateStr.match(/pickup_date=(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    update.pickup_date = dateMatch[1];
  }

  // Parse pickup time
  const timeMatch = updateStr.match(/pickup_time="([^"]+)"/i);
  if (timeMatch) {
    update.pickup_time = timeMatch[1];
  }

  // Parse pickup location
  const locationMatch = updateStr.match(/pickup_location="([^"]+)"/i);
  if (locationMatch) {
    update.pickup_location = locationMatch[1];
  }

  // Parse delivery method
  const deliveryMatch = updateStr.match(/delivery_method=(pickup|shipping)/i);
  if (deliveryMatch) {
    update.delivery_method = deliveryMatch[1].toLowerCase() as 'pickup' | 'shipping';
  }

  return Object.keys(update).length > 0 ? update : null;
}

/**
 * Parse action needed from agent response
 * Looks for [ACTION_NEEDED: ...] tags in the output
 */
export function parseActionNeeded(output: string): ActionNeededType | null {
  const actionMatch = output.match(/\[ACTION_NEEDED:\s*type=([^\]]+)\]/i);
  if (!actionMatch) return null;

  const actionType = actionMatch[1].trim().toLowerCase();
  const validTypes: ActionNeededType[] = ['accept_offer', 'counter_offer', 'confirm_pickup', 'finalize', 'provide_payment', 'suggest_times'];

  if (validTypes.includes(actionType as ActionNeededType)) {
    return actionType as ActionNeededType;
  }
  return null;
}

/**
 * Remove action needed tags from output before sending to client
 */
export function cleanActionTags(output: string): string {
  return output.replace(/\s*\[ACTION_NEEDED:[^\]]+\]\s*/gi, '').trim();
}

/**
 * Update deal in database based on parsed updates
 */
async function updateDealFromChat(
  dealId: string,
  updates: DealUpdate,
): Promise<boolean> {
  const client = createServiceClient();
  if (!client) {
    console.warn("⚠️ [chatbot] Cannot update deal - no Supabase client");
    return false;
  }

  const dbUpdates: Record<string, unknown> = {};

  if (updates.offer !== undefined) {
    dbUpdates.current_offer = updates.offer;
  }
  if (updates.agreed_price !== undefined) {
    dbUpdates.agreed_price = updates.agreed_price;
  }
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
  }
  if (updates.payment_method !== undefined) {
    dbUpdates.payment_method = updates.payment_method;
  }
  if (updates.pickup_date !== undefined) {
    dbUpdates.pickup_date = updates.pickup_date;
  }
  if (updates.pickup_time !== undefined) {
    dbUpdates.pickup_time = updates.pickup_time;
  }
  if (updates.pickup_location !== undefined) {
    dbUpdates.pickup_location = updates.pickup_location;
  }
  if (updates.delivery_method !== undefined) {
    dbUpdates.delivery_method = updates.delivery_method;
  }

  if (Object.keys(dbUpdates).length === 0) {
    return false;
  }

  console.log("📝 [chatbot] Updating deal:", { dealId, updates: dbUpdates });

  const { error } = await client
    .from("deals")
    .update(dbUpdates)
    .eq("id", dealId);

  if (error) {
    console.error("❌ [chatbot] Failed to update deal:", error);
    return false;
  }

  console.log("✅ [chatbot] Deal updated successfully");
  return true;
}

/**
 * Remove deal update tags from output before sending to client
 */
export function cleanDealUpdateTags(output: string): string {
  return output.replace(/\s*\[DEAL_UPDATE:[^\]]+\]\s*/gi, '').trim();
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
  console.log("🌐 [chatbot] Request received:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (req.method === "OPTIONS") {
    console.log("✅ [chatbot] OPTIONS request - returning CORS headers");
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
    console.warn("⚠️ [chatbot] Invalid method:", req.method);
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
    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      console.error("❌ [chatbot] CLAUDE_API_KEY not set");
      return new Response(
        JSON.stringify({
          error:
            "CLAUDE_API_KEY is not set. Configure this secret in Supabase.",
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
      const requestBody = body as Partial<ChatbotRequest>;
      console.log("📥 [chatbot] Request body parsed:", {
        hasUserMessage: !!requestBody?.userMessage,
        userMessageLength: requestBody?.userMessage?.length || 0,
        hasConversationHistory: !!requestBody?.conversationHistory,
        conversationHistoryLength: requestBody?.conversationHistory?.length || 0,
        hasSystemPrompt: !!requestBody?.systemPrompt,
        hasContext: !!requestBody?.context,
        context: requestBody?.context,
      });
    } catch {
      console.error("❌ [chatbot] Failed to parse JSON body");
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
      console.error("❌ [chatbot] Missing or invalid userMessage:", {
        hasUserMessage: !!userMessage,
        userMessageType: typeof userMessage,
      });
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

    const client = new Anthropic({ apiKey });

    // Fetch any referenced Supabase objects (items, deals) so we can
    // provide grounded numeric context to the LLM.
    console.log("🔍 [chatbot] Fetching database context:", context);
    const { item, deal, competingOffers } = await fetchDbContext(context);
    console.log("📊 [chatbot] Database context fetched:", {
      hasItem: !!item,
      itemId: item?.id,
      itemTitle: item?.title || item?.label,
      itemCondition: item?.condition,
      hasDeal: !!deal,
      dealId: deal?.id,
      competingOffersCount: competingOffers?.length || 0,
    });

    const dbContextSummary = buildDbContextSummary(item, deal, competingOffers);
    console.log("📝 [chatbot] Database context summary:", {
      summaryLength: dbContextSummary.length,
      summary: dbContextSummary.substring(0, 200) + (dbContextSummary.length > 200 ? "..." : ""),
    });

    // Use mediator prompt when we have a deal context (three-way chat)
    const isThreeWayChat = !!deal;
    const baseSystemPrompt =
      systemPrompt && typeof systemPrompt === "string"
        ? systemPrompt
        : isThreeWayChat
          ? MEDIATOR_SYSTEM_PROMPT
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

    console.log("🎭 [chatbot] Chat mode:", isThreeWayChat ? "THREE-WAY MEDIATOR" : "STANDARD");

    // Build messages array for Claude (without system message in array)
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Filter out system messages from history (we'll pass separately)
      const historyMessages = conversationHistory.filter(
        (msg) => msg.role !== "system"
      );
      // Convert to Claude message format (user | assistant)
      messages.push(
        ...historyMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }))
      );
      console.log("💭 [chatbot] Added conversation history:", {
        originalLength: conversationHistory.length,
        filteredLength: historyMessages.length,
      });
    }

    // Add the current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    console.log("🤖 [chatbot] Calling Claude API:", {
      model: "claude-opus-4-5-20251101",
      messagesCount: messages.length,
      systemPromptLength: finalSystemPrompt.length,
      userMessageLength: userMessage.length,
    });

    const startTime = Date.now();
    const response = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: finalSystemPrompt,
      messages: messages,
    });
    const claudeDuration = Date.now() - startTime;

    const output =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    console.log("✨ [chatbot] Claude response received:", {
      outputLength: output.length,
      outputPreview: output.substring(0, 200) + (output.length > 200 ? "..." : ""),
      contentBlocksCount: response.content.length,
      duration: `${claudeDuration}ms`,
    });

    // Parse deal updates from agent response (for three-way chat)
    const dealUpdates = parseDealUpdates(output);
    let dealUpdated = false;

    if (dealUpdates && deal?.id) {
      console.log("🔄 [chatbot] Deal updates detected:", dealUpdates);
      dealUpdated = await updateDealFromChat(deal.id, dealUpdates);
    }

    // Parse action needed from agent response
    const actionNeeded = parseActionNeeded(output);
    if (actionNeeded) {
      console.log("🎯 [chatbot] Action needed detected:", actionNeeded);
    }

    // Clean output for client (remove [DEAL_UPDATE:] and [ACTION_NEEDED:] tags)
    let cleanOutput = cleanDealUpdateTags(output);
    cleanOutput = cleanActionTags(cleanOutput);

    const priceReferences = extractPriceReferencesFromOutput(
      cleanOutput,
      item,
      deal,
    );

    console.log("💰 [chatbot] Price references extracted:", {
      count: priceReferences.length,
      references: priceReferences,
    });

    const responseBody: ChatbotResponse = {
      output: cleanOutput,
      // Only include if non-empty to keep payload lean and backwards compatible.
      ...(priceReferences.length > 0 ? { priceReferences } : {}),
      ...(dealUpdates ? { dealUpdates } : {}),
      ...(dealUpdated ? { dealUpdated } : {}),
      ...(actionNeeded ? { actionNeeded } : {}),
    };

    console.log("✅ [chatbot] Sending response:", {
      status: 200,
      outputLength: responseBody.output.length,
      hasPriceReferences: !!responseBody.priceReferences,
      priceReferencesCount: responseBody.priceReferences?.length || 0,
      hasDealUpdates: !!responseBody.dealUpdates,
      dealUpdated: responseBody.dealUpdated,
      actionNeeded: responseBody.actionNeeded,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("❌ [chatbot] Error in chatbot function:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
    });
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


