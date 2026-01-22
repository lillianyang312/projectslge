import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist";

// Deno global
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// Type definitions
interface PDFExtractionRequest {
  pdfPath: string;
  userId: string;
}

interface ExtractedPage {
  pageNumber: number;
  text: string;
  imagePath?: string; // Storage path if image was uploaded
  // NOTE: Image data is NOT stored here to avoid memory overflow
  // (raw image data from PDF.js is uncompressed and very large)
}

interface ExtractedItem {
  title: string;
  category: string;
  description: string;
  photos: string[];
  user_min_price?: number;
  user_max_price?: number;
  condition?: "new" | "like_new" | "good" | "fair" | "poor";
  isSold?: boolean;
  confidence?: number;
}

interface PDFExtractionResponse {
  success: boolean;
  items: ExtractedItem[];
  errors?: string[];
  metadata?: {
    totalPages: number;
    totalItems: number;
    extractedAt: string;
  };
}


// Initialize clients
function initializeClients() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const claudeKey = Deno.env.get("CLAUDE_API_KEY");

  if (!supabaseUrl || !supabaseKey || !claudeKey) {
    throw new Error("Missing required environment variables");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: claudeKey });

  return { supabase, anthropic };
}


/**
 * Extract pages from PDF buffer (text only, optimized for CPU/memory)
 */
async function extractPagesFromPDF(
  pdfBuffer: ArrayBuffer,
  batchSize: number = 2
): Promise<ExtractedPage[]> {
  const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
  const allPages: ExtractedPage[] = [];
  const totalPages = pdf.numPages;

  console.log(`Starting PDF extraction: ${totalPages} pages total`);

  // Process pages in small batches (size=2) to minimize memory
  for (let startPage = 1; startPage <= totalPages; startPage += batchSize) {
    const endPage = Math.min(startPage + batchSize - 1, totalPages);
    console.log(
      `Processing batch: pages ${startPage}-${endPage} of ${totalPages}`
    );

    // Process this batch
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        // @ts-ignore - PDF.js page object has complex internal structure
        // deno-lint-ignore no-explicit-any
        const page: any = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        // @ts-ignore - PDF.js items have dynamic structure
        const text = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .slice(0, 1000); // Limit text to first 1000 chars to save memory

        // NOTE: Image extraction disabled due to CPU/memory constraints
        // Images can be added manually by users after item creation
        allPages.push({
          pageNumber: pageNum,
          text: text,
          imagePath: "",
        });
      } catch (err) {
        console.warn(`Failed to process page ${pageNum}:`, err);
      }
    }

    // Release batch memory before processing next batch
    if (endPage < totalPages) {
      console.log(`Batch ${startPage}-${endPage} complete. Releasing memory...`);
      // Force garbage collection between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`Extracted ${allPages.length} pages from PDF`);
  return allPages;
}

/**
 * Download PDF from Supabase Storage
 */
// @ts-ignore - Supabase client has complex types
async function downloadPDFFromStorage(
  supabase: any,
  pdfPath: string
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage
    .from("item-pdfs")
    .download(pdfPath);

  if (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }

  return await data.arrayBuffer();
}


/**
 * Use Claude to parse extracted PDF text and structure items
 */
// @ts-ignore - Anthropic SDK client has complex types
async function parseItemsWithClaude(
  anthropic: any,
  pdfText: string,
  pageTexts: string[]
): Promise<Array<{ title: string; description: string; price?: string }>> {
  const systemPrompt = `You are a PDF parser for senior sale slideshows. Your job is to extract individual items and their information.

Each item typically has:
- A price (often starting with $)
- A title/name
- A description (condition, size, brand, etc.)
- Sometimes notes about if it's sold or available

Extract all items and return them as a JSON array. For each item, include:
- title: The name of the item
- description: Full description including condition, size, notes, etc.
- price: The asking price (just the number, or null if free)
- isSold: boolean indicating if marked as sold/unavailable

Important:
- If it mentions "sold", "unavailable", or similar, set isSold to true
- Extract ALL items, even text-only ones
- Preserve all condition/size/brand information in the description
- Return ONLY valid JSON array, no markdown or explanation`;

  const userPrompt = `Parse this senior sale PDF content and extract all items. Return a JSON array of items.

PDF Content (multiple pages separated by ---):
${pageTexts.map((text, i) => `\n=== PAGE ${i + 1} ===\n${text}`).join("\n\n")}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // @ts-ignore - Claude response content array items have dynamic types
    const textContent = response.content.find(
      (block: any) => block.type === "text"
    );
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    let jsonString = textContent.text;
    // Remove markdown code blocks if present
    if (jsonString.includes("```json")) {
      jsonString = jsonString.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonString.includes("```")) {
      jsonString = jsonString.replace(/```\n?/g, "");
    }

    const items = JSON.parse(jsonString.trim());
    return Array.isArray(items) ? items : [items];
  } catch (error) {
    console.error("Error parsing with Claude:", error);
    return [];
  }
}

/**
 * Map extracted item data to the final schema
 */
// @ts-ignore - Parsed item from Claude has dynamic structure
function mapToExtractedItem(
  parsedItem: any,
  imagePath?: string
): ExtractedItem {
  // Extract price from price string if needed
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  if (parsedItem.price) {
    const priceStr = String(parsedItem.price).replace(/[^0-9.-]/g, "");
    const price = parseFloat(priceStr);
    if (!isNaN(price) && price > 0) {
      minPrice = Math.max(price * 0.8, 0);
      maxPrice = price;
    }
  }

  // Infer condition from description
  const description = (parsedItem.description || "").toLowerCase();
  let condition: ExtractedItem["condition"] = "good";

  if (
    description.includes("new") ||
    description.includes("unopened") ||
    description.includes("like new")
  ) {
    condition = "like_new";
  } else if (
    description.includes("excellent") ||
    description.includes("barely used")
  ) {
    condition = "good";
  } else if (description.includes("fair")) {
    condition = "fair";
  } else if (description.includes("poor") || description.includes("beat")) {
    condition = "poor";
  }

  // Infer category from title and description
  const fullText = (
    (parsedItem.title || "") +
    " " +
    (parsedItem.description || "")
  ).toLowerCase();
  let category = "other";

  if (
    fullText.includes("laptop") ||
    fullText.includes("computer") ||
    fullText.includes("phone") ||
    fullText.includes("headphone") ||
    fullText.includes("cable") ||
    fullText.includes("hub") ||
    fullText.includes("ethernet")
  ) {
    category = "electronics";
  } else if (
    fullText.includes("shirt") ||
    fullText.includes("pants") ||
    fullText.includes("jeans") ||
    fullText.includes("sweatshirt") ||
    fullText.includes("jacket") ||
    fullText.includes("shoes") ||
    fullText.includes("kyries")
  ) {
    category = "clothing";
  } else if (
    fullText.includes("book") ||
    fullText.includes("play") ||
    fullText.includes("hazard")
  ) {
    category = "books";
  } else if (
    fullText.includes("shampoo") ||
    fullText.includes("conditioner") ||
    fullText.includes("brace")
  ) {
    category = "other";
  } else if (fullText.includes("furniture") || fullText.includes("riser")) {
    category = "furniture";
  }

  return {
    title: parsedItem.title || "Untitled Item",
    category,
    description: parsedItem.description || "",
    photos: imagePath ? [imagePath] : [],
    user_min_price: minPrice,
    user_max_price: maxPrice,
    condition,
    isSold: parsedItem.isSold || false,
    confidence: 0.85,
  };
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { supabase, anthropic } = initializeClients();
    const body = await req.json() as PDFExtractionRequest;

    if (!body.pdfPath || !body.userId) {
      return new Response(
        JSON.stringify({ error: "pdfPath and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Extracting PDF: ${body.pdfPath} for user: ${body.userId}`
    );

    // Download PDF from storage
    let pdfBuffer: ArrayBuffer | undefined = await downloadPDFFromStorage(
      supabase,
      body.pdfPath
    );

    // Extract pages from PDF (text only)
    const pages = await extractPagesFromPDF(pdfBuffer);

    // CRITICAL: Explicitly release PDF buffer to free ~2MB of memory
    // The PDF buffer is no longer needed after page extraction
    // This prevents memory overflow before Claude API processing
    pdfBuffer = undefined;
    // Allow garbage collection
    await new Promise((resolve) => setTimeout(resolve, 50));

    const pageTexts = pages.map((p) => p.text);

    console.log(`Extracted ${pages.length} pages from PDF`);

    // Parse items using Claude
    const parsedItems = await parseItemsWithClaude(
      anthropic,
      "",
      pageTexts
    );

    console.log(`Claude identified ${parsedItems.length} items`);

    // Map to final format with images
    // Skip page 1 (cover) when mapping images to items
    const items: ExtractedItem[] = parsedItems.map((item, index) => {
      const pageIndex = index + 1; // Page 2 = item 0, Page 3 = item 1, etc.
      const pageData = pages[pageIndex];

      // Get image path from page data (if image was successfully uploaded)
      const imagePath = pageData?.imagePath || "";

      return mapToExtractedItem(item, imagePath);
    });

    const response: PDFExtractionResponse = {
      success: true,
      items,
      metadata: {
        totalPages: pages.length,
        totalItems: items.length,
        extractedAt: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        items: [],
        errors: [
          error instanceof Error ? error.message : "Unknown error occurred",
        ],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
