import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { yamlToPromptString } from "../yamlToPromptString";

// Load environment variables from .env file
// Checks for .env file in the docs directory (where package.json is located)
// Falls back to current working directory if not found
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback to default location (current working directory)
  dotenv.config();
}

/**
 * Types for evaluation test cases
 */
export interface ImageQuery {
  type: "image";
  imagePath: string;
  query: string;
  expectedBehavior?: string; // Optional description of expected behavior
}

export interface TextQuery {
  type: "text";
  query: string;
  expectedBehavior?: string;
}

export type TestCase = ImageQuery | TextQuery;

export interface EvaluationResult {
  testCase: TestCase;
  prompt: string;
  response: string;
  model: string;
  timestamp: string;
  metadata?: {
    tokensUsed?: number;
    finishReason?: string;
    latency?: number;
  };
}

export interface EvaluationConfig {
  model?: string; // e.g., "gpt-4o", "gpt-4o-mini", "gpt-4-vision-preview"
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  promptTemplate?: string;
}

/**
 * OpenAI API client for running evaluations
 */
export class OpenAIEvaluator {
  private client: OpenAI;
  private config: Required<EvaluationConfig>;

  constructor(apiKey?: string, config: EvaluationConfig = {}) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor."
      );
    }

    this.client = new OpenAI({ apiKey: key });
    this.config = {
      model: config.model || "gpt-4o",
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 1000,
      systemPrompt: config.systemPrompt || "",
      promptTemplate: config.promptTemplate || "{userQuery}",
    };
  }

  /**
   * Loads a prompt from a YAML file and uses it as the system prompt
   */
  loadPromptFromYaml(yamlPath: string): void {
    const promptContent = yamlToPromptString(yamlPath);
    this.config.systemPrompt = promptContent;
  }

  /**
   * Converts an image file to base64 for OpenAI API
   */
  private async imageToBase64(imagePath: string): Promise<string> {
    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${resolvedPath}`);
    }

    const imageBuffer = fs.readFileSync(resolvedPath);
    const base64Image = imageBuffer.toString("base64");
    
    // Determine MIME type from file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypes[ext] || "image/jpeg";

    return `data:${mimeType};base64,${base64Image}`;
  }

  /**
   * Formats the user query using the prompt template
   */
  private formatUserQuery(query: string): string {
    return this.config.promptTemplate.replace("{userQuery}", query);
  }

  /**
   * Runs a single test case evaluation
   */
  async evaluateTestCase(testCase: TestCase): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      // Add system prompt if provided
      if (this.config.systemPrompt) {
        messages.push({
          role: "system",
          content: this.config.systemPrompt,
        });
      }

      // Handle image or text query
      if (testCase.type === "image") {
        const base64Image = await this.imageToBase64(testCase.imagePath);
        const formattedQuery = this.formatUserQuery(testCase.query);

        messages.push({
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
            {
              type: "text",
              text: formattedQuery,
            },
          ],
        });
      } else {
        const formattedQuery = this.formatUserQuery(testCase.query);
        messages.push({
          role: "user",
          content: formattedQuery,
        });
      }

      // Make API call
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const latency = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || "";
      const finishReason = completion.choices[0]?.finish_reason || "";
      const tokensUsed =
        (completion.usage?.prompt_tokens || 0) +
        (completion.usage?.completion_tokens || 0);

      return {
        testCase,
        prompt: this.config.systemPrompt || "",
        response,
        model: this.config.model,
        timestamp: new Date().toISOString(),
        metadata: {
          tokensUsed,
          finishReason,
          latency,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      throw new Error(
        `Evaluation failed for test case: ${JSON.stringify(testCase)}. Error: ${
          error instanceof Error ? error.message : String(error)
        }. Latency: ${latency}ms`
      );
    }
  }

  /**
   * Runs multiple test cases and returns all results
   */
  async evaluateTestCases(
    testCases: TestCase[]
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(
        `\n[${i + 1}/${testCases.length}] Evaluating test case: ${testCase.query.substring(0, 50)}...`
      );

      try {
        const result = await this.evaluateTestCase(testCase);
        results.push(result);
        console.log(`✓ Completed in ${result.metadata?.latency}ms`);
      } catch (error) {
        console.error(`✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other test cases even if one fails
      }
    }

    return results;
  }

  /**
   * Saves evaluation results to a JSON file
   */
  async saveResults(
    results: EvaluationResult[],
    outputPath: string
  ): Promise<void> {
    const resolvedPath = path.resolve(outputPath);
    const outputDir = path.dirname(resolvedPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      resolvedPath,
      JSON.stringify(results, null, 2),
      "utf-8"
    );

    console.log(`\n✓ Results saved to: ${resolvedPath}`);
  }

  /**
   * Prints a summary of evaluation results
   */
  printSummary(results: EvaluationResult[]): void {
    console.log("\n" + "=".repeat(60));
    console.log("EVALUATION SUMMARY");
    console.log("=".repeat(60));

    const totalTests = results.length;
    const totalTokens = results.reduce(
      (sum, r) => sum + (r.metadata?.tokensUsed || 0),
      0
    );
    const avgLatency =
      results.reduce((sum, r) => sum + (r.metadata?.latency || 0), 0) /
      totalTests;

    console.log(`Total test cases: ${totalTests}`);
    console.log(`Total tokens used: ${totalTokens}`);
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);

    console.log("\nResults by test case:");
    results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.testCase.query.substring(0, 60)}...`);
      console.log(`  Type: ${result.testCase.type}`);
      console.log(`  Response length: ${result.response.length} chars`);
      console.log(`  Tokens: ${result.metadata?.tokensUsed || 0}`);
      console.log(`  Latency: ${result.metadata?.latency || 0}ms`);
      if (result.testCase.expectedBehavior) {
        console.log(`  Expected: ${result.testCase.expectedBehavior}`);
      }
    });
  }
}

/**
 * Example test cases for an online selling/buying app
 */
export const EXAMPLE_TEST_CASES: TestCase[] = [
  {
    type: "image",
    imagePath: "../../static/closet_example.jpg",
    query: "What items do you see in this image? Can you identify any specific brands or models?",
    expectedBehavior: "Should identify items and provide specific details if confident",
  },
  {
    type: "image",
    imagePath: "../../static/diamond_ring.jpeg",
    query: "What would be a fair price for the item in this image?",
    expectedBehavior: "Should provide pricing suggestions with rationale",
  },
  {
    type: "text",
    query: "I want to sell a MacBook Pro from 2022. What should I list it for?",
    expectedBehavior: "Should provide pricing suggestion with reasoning",
  },
  {
    type: "text",
    query: "Can you help me identify this item? It's a black jacket with a zipper.",
    expectedBehavior: "Should ask for clarifying questions or more details",
  },
  {
    type: "text",
    query: "I received an offer for $50 on my item. Should I accept?",
    expectedBehavior: "Should provide guidance on whether to accept, counter, or decline",
  },
];

/**
 * Main execution function for running evaluations
 */
async function main() {
  // Initialize evaluator
  const evaluator = new OpenAIEvaluator(undefined, {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 1000,
  });

  // Load prompt from YAML file
  try {
    evaluator.loadPromptFromYaml("./prompts/general_personality.yaml");
    console.log("✓ Loaded prompt from YAML file");
  } catch (error) {
    console.warn(
      `Warning: Could not load YAML prompt: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Run evaluations
  console.log("Starting evaluation suite...\n");
  const results = await evaluator.evaluateTestCases(EXAMPLE_TEST_CASES);

  // Print summary
  evaluator.printSummary(results);

  // Save results
  const outputPath = path.join(process.cwd(), "eval", "eval_results.json");
  await evaluator.saveResults(results, outputPath);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

