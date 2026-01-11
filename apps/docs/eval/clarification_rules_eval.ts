import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { yamlToPromptString } from "../yamlToPromptString";
import { OpenAIEvaluator, TestCase, EvaluationResult } from "./openai_api";

// Load environment variables
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/**
 * Test cases specifically for clarification rules evaluation
 * These test cases validate that the multi-modal LLM follows the clarification
 * rules based on confidence levels (high, medium, low).
 * 
 * The clarification_rules.yaml prompt should guide the LLM to respond in the
 * correct schema format based on confidence thresholds.
 */
export const CLARIFICATION_TEST_CASES: TestCase[] = [
  // High confidence test cases - should return "identified" type
  {
    type: "image",
    imagePath: "../../static/diamond_ring.jpeg",
    query: "Identify this item from the image. Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'identified' with confidence >= 0.85 if the item is clearly identifiable",
  },
  {
    type: "image",
    imagePath: "../../static/closet_example.jpg",
    query: "Identify the most prominent item in this image. Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'identified' if confidence is high (>= 0.85), or 'needs_clarification' with appropriate options/question if confidence is medium/low",
  },

  // Medium confidence test cases - should return "needs_clarification" with options
  {
    type: "text",
    query: "I have a photo of an office chair but I'm not sure of the exact model. Can you help identify it? Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'needs_clarification' with options array (2-8 options, preferably power of 2) if confidence is medium (0.60-0.84)",
  },
  {
    type: "text",
    query: "I'm trying to list a piece of furniture - it's a chair but I can't tell the brand. Can you help identify it? Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'needs_clarification' with multiple options (medium confidence scenario)",
  },

  // Low confidence test cases - should return "needs_clarification" with question, empty options
  {
    type: "text",
    query: "I have a blurry photo of something. Can you help me identify what it is? Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'needs_clarification' with a targeted question and empty options array if confidence is low (<= 0.59)",
  },
  {
    type: "text",
    query: "Help me identify an item I want to sell. I only know it's made of metal. Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'needs_clarification' with a specific, actionable question and empty options (low confidence scenario)",
  },

  // Edge case: Very clear item that should be high confidence
  {
    type: "text",
    query: "I'm selling a Herman Miller Aeron Chair, size B, in like-new condition. Identify this item. Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'identified' with high confidence (>= 0.85) since all details are provided",
  },

  // Edge case: Ambiguous item that needs clarification
  {
    type: "text",
    query: "I have something in a box. Can you identify it? Return your response in JSON format following the clarification schema.",
    expectedBehavior: "Should return type: 'needs_clarification' with a question asking for more details (low confidence)",
  },
];

/**
 * Validates that a response follows the clarification schema structure
 */
export function validateClarificationResponse(response: string): {
  isValid: boolean;
  errors: string[];
  parsed?: any;
} {
  const errors: string[] = [];
  let parsed: any = null;

  try {
    // Try to parse JSON (responses might be wrapped in markdown code blocks)
    let jsonString = response.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    parsed = JSON.parse(jsonString);

    // Validate required fields
    if (parsed.type !== "identified" && parsed.type !== "needs_clarification") {
      errors.push(`Invalid type: must be "identified" or "needs_clarification", got "${parsed.type}"`);
    }

    if (typeof parsed.confidence !== "number") {
      errors.push("confidence must be a number");
    } else if (parsed.confidence < 0 || parsed.confidence > 1) {
      errors.push(`confidence must be in range [0.0, 1.0], got ${parsed.confidence}`);
    }

    // Validate based on type
    if (parsed.type === "identified") {
      if (!parsed.item) {
        errors.push("item is required when type is 'identified'");
      } else {
        if (!parsed.item.title || typeof parsed.item.title !== "string") {
          errors.push("item.title is required and must be a string");
        }
        if (!parsed.item.category || typeof parsed.item.category !== "string") {
          errors.push("item.category is required and must be a string");
        }
      }
    } else if (parsed.type === "needs_clarification") {
      if (!parsed.question || typeof parsed.question !== "string") {
        errors.push("question is required when type is 'needs_clarification'");
      }
      if (!Array.isArray(parsed.options)) {
        errors.push("options must be an array when type is 'needs_clarification'");
      } else {
        // Validate options structure if present
        parsed.options.forEach((opt: any, index: number) => {
          if (!opt.label || typeof opt.label !== "string") {
            errors.push(`options[${index}].label is required and must be a string`);
          }
          if (!opt.id || typeof opt.id !== "string") {
            errors.push(`options[${index}].id is required and must be a string`);
          }
          if (!opt.descriptor || typeof opt.descriptor !== "string") {
            errors.push(`options[${index}].descriptor is required and must be a string`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsed,
    };
  } catch (error) {
    errors.push(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Checks if the confidence level matches the expected behavior based on thresholds
 */
export function validateConfidenceLevel(
  confidence: number,
  responseType: "identified" | "needs_clarification",
  hasOptions: boolean
): {
  isValid: boolean;
  level: "high" | "medium" | "low";
  message: string;
} {
  const HIGH_MIN = 0.85;
  const MEDIUM_MIN = 0.60;

  let level: "high" | "medium" | "low";
  if (confidence >= HIGH_MIN) {
    level = "high";
  } else if (confidence >= MEDIUM_MIN) {
    level = "medium";
  } else {
    level = "low";
  }

  let isValid = true;
  let message = `Confidence: ${confidence.toFixed(2)} (${level})`;

  // Validate consistency
  if (responseType === "identified" && level !== "high") {
    isValid = false;
    message += ` - Expected high confidence (>= ${HIGH_MIN}) for identified type`;
  } else if (responseType === "needs_clarification") {
    if (hasOptions && level === "low") {
      isValid = false;
      message += ` - Options provided but confidence is low (expected medium/high)`;
    } else if (!hasOptions && level === "high") {
      isValid = false;
      message += ` - No options provided but confidence is high (expected medium/low)`;
    }
  }

  return { isValid, level, message };
}

/**
 * Enhanced summary that includes clarification schema validation
 */
export function printClarificationSummary(results: EvaluationResult[]): void {
  console.log("\n" + "=".repeat(60));
  console.log("CLARIFICATION RULES EVALUATION SUMMARY");
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

    // Validate response
    const validation = validateClarificationResponse(result.response);
    if (validation.isValid && validation.parsed) {
      console.log(`  ✓ Schema validation: PASSED`);
      const confidenceCheck = validateConfidenceLevel(
        validation.parsed.confidence,
        validation.parsed.type,
        validation.parsed.options?.length > 0
      );
      console.log(`  ${confidenceCheck.isValid ? "✓" : "✗"} ${confidenceCheck.message}`);
      console.log(`  Response type: ${validation.parsed.type}`);
      if (validation.parsed.type === "needs_clarification") {
        console.log(`  Options count: ${validation.parsed.options?.length || 0}`);
        console.log(`  Question: ${validation.parsed.question?.substring(0, 60)}...`);
      } else {
        console.log(`  Item: ${validation.parsed.item?.title || "N/A"}`);
      }
    } else {
      console.log(`  ✗ Schema validation: FAILED`);
      validation.errors.forEach((error) => {
        console.log(`    - ${error}`);
      });
    }

    if (result.testCase.expectedBehavior) {
      console.log(`  Expected: ${result.testCase.expectedBehavior}`);
    }
  });
}

/**
 * Main execution function for clarification rules evaluation
 */
async function main() {
  // Initialize evaluator
  const evaluator = new OpenAIEvaluator(undefined, {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 2000, // Increased for structured JSON responses
  });

  // Load clarification rules prompt from YAML file
  try {
    evaluator.loadPromptFromYaml("./prompts/clarification_rules.yaml");
    console.log("✓ Loaded clarification rules prompt from YAML file");
  } catch (error) {
    console.warn(
      `Warning: Could not load YAML prompt: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Run evaluations
  console.log("Starting clarification rules evaluation suite...\n");
  const results = await evaluator.evaluateTestCases(CLARIFICATION_TEST_CASES);

  // Print enhanced summary with validation
  printClarificationSummary(results);

  // Save results
  const outputPath = path.join(
    process.cwd(),
    "eval",
    "clarification_rules_eval_results.json"
  );
  await evaluator.saveResults(results, outputPath);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

