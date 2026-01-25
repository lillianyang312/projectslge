import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface StartPDFExtractionRequest {
  pdfPath: string;
  userId: string;
}

interface ExtractedPage {
  pageNumber: number;
  text: string;
}

interface ParsedItem {
  title: string;
  description: string;
  price?: string | number;
  isSold?: boolean;
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
 * Download PDF from Supabase Storage
 */
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
 * Extract specific pages from PDF buffer
 */
async function extractPagesFromPDF(
  pdfBuffer: ArrayBuffer,
  startPage: number,
  endPage: number
): Promise<ExtractedPage[]> {
  const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
  const allPages: ExtractedPage[] = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    try {
      const page: any = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .slice(0, 2000); // Increased to 2000 chars for better context

      allPages.push({
        pageNumber: pageNum,
        text: text,
      });
    } catch (err) {
      console.warn(`Failed to process page ${pageNum}:`, err);
      allPages.push({
        pageNumber: pageNum,
        text: "",
      });
    }
  }

  return allPages;
}

/**
 * Parse extracted pages with Claude (with retry logic)
 */
async function parseItemsWithClaude(
  anthropic: any,
  pageTexts: string[],
  retries: number = 3
): Promise<ParsedItem[]> {
  const systemPrompt = `You are a PDF parser for senior sale slideshows. Extract individual items and their information.

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

PDF Content (pages separated by ---):
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

    const textContent = response.content.find(
      (block: any) => block.type === "text"
    );
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    let jsonString = textContent.text;
    if (jsonString.includes("```json")) {
      jsonString = jsonString.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonString.includes("```")) {
      jsonString = jsonString.replace(/```\n?/g, "");
    }

    const items = JSON.parse(jsonString.trim());
    return Array.isArray(items) ? items : [items];
  } catch (error) {
    console.error("Error parsing with Claude:", error);

    // Retry on overloaded error (529) or rate limit (429)
    const errorStatus = (error as any)?.status;
    if ((errorStatus === 529 || errorStatus === 429) && retries > 0) {
      const delay = Math.pow(2, 4 - retries) * 1000; // exponential backoff
      console.log(`Retrying after ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return parseItemsWithClaude(anthropic, pageTexts, retries - 1);
    }

    return [];
  }
}

/**
 * Store extracted items in database
 */
async function storeExtractedItems(
  supabase: any,
  jobId: string,
  parsedItems: ParsedItem[]
): Promise<void> {
  for (const item of parsedItems) {
    // Parse price
    let minPrice: number | undefined;
    let maxPrice: number | undefined;

    if (item.price) {
      const priceStr = String(item.price).replace(/[^0-9.-]/g, "");
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        minPrice = Math.max(price * 0.8, 0);
        maxPrice = price;
      }
    }

    // Infer condition from description
    const description = (item.description || "").toLowerCase();
    let condition = "good";

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

    // Infer category
    const fullText = (
      (item.title || "") +
      " " +
      (item.description || "")
    ).toLowerCase();
    let category = "other";

    if (
      fullText.includes("laptop") ||
      fullText.includes("computer") ||
      fullText.includes("phone") ||
      fullText.includes("headphone") ||
      fullText.includes("cable") ||
      fullText.includes("hub")
    ) {
      category = "electronics";
    } else if (
      fullText.includes("shirt") ||
      fullText.includes("pants") ||
      fullText.includes("jeans") ||
      fullText.includes("sweatshirt") ||
      fullText.includes("jacket") ||
      fullText.includes("shoes")
    ) {
      category = "clothing";
    } else if (fullText.includes("book") || fullText.includes("play")) {
      category = "books";
    } else if (
      fullText.includes("furniture") ||
      fullText.includes("desk") ||
      fullText.includes("chair")
    ) {
      category = "furniture";
    }

    const { error } = await supabase.from("pdf_extraction_items").insert({
      job_id: jobId,
      title: item.title || "Untitled Item",
      category,
      description: item.description || "",
      condition,
      user_min_price: minPrice,
      user_max_price: maxPrice,
      is_sold: item.isSold || false,
      confidence: 0.85,
      raw_data: item,
    });

    if (error) {
      console.error("Error storing item:", error);
    }
  }
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
    const body = (await req.json()) as StartPDFExtractionRequest;

    if (!body.pdfPath || !body.userId) {
      return new Response(
        JSON.stringify({ error: "pdfPath and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Starting PDF extraction: ${body.pdfPath} for user: ${body.userId}`
    );

    // Download PDF
    let pdfBuffer = await downloadPDFFromStorage(supabase, body.pdfPath);

    // Get total page count
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const totalPages = pdf.numPages;

    console.log(`PDF has ${totalPages} pages`);

    // Create job record
    const { data: jobData, error: jobError } = await supabase
      .from("pdf_extraction_jobs")
      .insert({
        user_id: body.userId,
        pdf_path: body.pdfPath,
        total_pages: totalPages,
        status: "processing",
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    const jobId = jobData.id;
    console.log(`Created job: ${jobId}`);

    // Process all batches sequentially
    const batchSize = 4;
    let pagesProcessed = 0;

    for (let batchNum = 1; batchNum * batchSize <= totalPages + batchSize; batchNum++) {
      const batchStart = (batchNum - 1) * batchSize + 1;
      const batchEnd = Math.min(batchNum * batchSize, totalPages);

      if (batchStart > totalPages) break; // All pages processed

      console.log(
        `Processing batch ${batchNum}: pages ${batchStart}-${batchEnd}`
      );

      // Download fresh PDF buffer for this batch (memory efficiency)
      if (batchNum > 1) {
        pdfBuffer = await downloadPDFFromStorage(supabase, body.pdfPath);
      }

      // Extract this batch
      const pages = await extractPagesFromPDF(
        pdfBuffer,
        batchStart,
        batchEnd
      );
      const pageTexts = pages.map((p) => p.text);

      console.log(`Extracted ${pages.length} pages for batch ${batchNum}`);

      // Parse with Claude
      const parsedItems = await parseItemsWithClaude(anthropic, pageTexts);
      console.log(`Parsed ${parsedItems.length} items from batch ${batchNum}`);

      // Store items
      await storeExtractedItems(supabase, jobId, parsedItems);

      pagesProcessed = batchEnd;

      // Update job progress
      await supabase
        .from("pdf_extraction_jobs")
        .update({
          pages_processed: pagesProcessed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`Batch ${batchNum} complete. Progress: ${pagesProcessed}/${totalPages}`);

      // Release PDF buffer between batches
      pdfBuffer = undefined as any;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Mark job as completed
    await supabase
      .from("pdf_extraction_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`Job ${jobId} completed! Processed ${pagesProcessed} pages.`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        status: "completed",
        totalPages,
        pagesProcessed,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PDF extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
