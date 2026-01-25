import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface ProcessPDFBatchRequest {
  jobId: string;
  batchNumber: number;
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
        .slice(0, 2000); // 2000 chars per page

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
 * Recursively invoke processPDFBatch for next batch
 */
async function invokePDFBatchProcessor(
  jobId: string,
  nextBatchNumber: number
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/processPDFBatch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({ jobId, batchNumber: nextBatchNumber }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `processPDFBatch returned ${response.status}: ${text}`
      );
    }

    console.log(`Invoked processPDFBatch for batch ${nextBatchNumber}`);
  } catch (err) {
    console.error("Error invoking processPDFBatch:", err);
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
    const body = (await req.json()) as ProcessPDFBatchRequest;

    if (!body.jobId || !body.batchNumber) {
      return new Response(
        JSON.stringify({ error: "jobId and batchNumber are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing batch ${body.batchNumber} for job ${body.jobId}`);

    // Get job from database
    const { data: jobData, error: jobError } = await supabase
      .from("pdf_extraction_jobs")
      .select("*")
      .eq("id", body.jobId)
      .single();

    if (jobError || !jobData) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    const { pdf_path, total_pages } = jobData;

    // Calculate page range for this batch
    // Batch 1 = pages 1-4, Batch 2 = pages 5-8, etc.
    // But startPDFExtraction handles batch 1, so:
    // Batch 2 = pages 5-8, Batch 3 = pages 9-12, etc.
    const batchSize = 4;
    const batchStart = (body.batchNumber - 1) * batchSize + 1;
    const batchEnd = Math.min(body.batchNumber * batchSize, total_pages);

    console.log(
      `Batch ${body.batchNumber}: processing pages ${batchStart}-${batchEnd}`
    );

    // Download PDF
    let pdfBuffer = await downloadPDFFromStorage(supabase, pdf_path);

    // Extract pages
    const pages = await extractPagesFromPDF(pdfBuffer, batchStart, batchEnd);
    const pageTexts = pages.map((p) => p.text);

    console.log(`Extracted ${pages.length} pages for batch ${body.batchNumber}`);

    // Parse with Claude
    const parsedItems = await parseItemsWithClaude(anthropic, pageTexts);
    console.log(
      `Parsed ${parsedItems.length} items from batch ${body.batchNumber}`
    );

    // Store items
    await storeExtractedItems(supabase, body.jobId, parsedItems);

    // Update job progress
    await supabase
      .from("pdf_extraction_jobs")
      .update({
        pages_processed: batchEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.jobId);

    console.log(
      `Updated job progress: ${batchEnd}/${total_pages} pages processed`
    );

    // Release PDF buffer
    const _ = pdfBuffer; // prevent unused variable warning
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check if there are more pages
    if (batchEnd < total_pages) {
      // Invoke processPDFBatch for next batch
      const nextBatchNumber = body.batchNumber + 1;
      console.log(
        `More pages remain. Invoking processPDFBatch for batch ${nextBatchNumber}...`
      );
      await invokePDFBatchProcessor(body.jobId, nextBatchNumber);
    } else {
      // All pages processed, mark job as completed
      await supabase
        .from("pdf_extraction_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.jobId);

      console.log(
        `Job ${body.jobId} completed! All ${total_pages} pages processed.`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: body.jobId,
        batchNumber: body.batchNumber,
        pagesProcessed: batchEnd,
        totalPages: total_pages,
        itemsInBatch: parsedItems.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PDF batch processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
