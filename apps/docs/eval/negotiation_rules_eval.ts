import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { yamlToPromptString } from "../yamlToPromptString";
import { OpenAIEvaluator, TestCase } from "./openai_api";

// Load environment variables
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/**
 * Test cases specifically for negotiation rules evaluation
 * These test cases validate that the Negotiation Mediator Agent follows
 * the guidelines in `negotiation_rules.yaml`:
 * - Acts as a neutral intermediary
 * - Does not reveal the seller's minimum price or urgency
 * - Uses market value and condition to justify pricing
 * - Aims to converge quickly to a deal at or above $40
 */
export const NEGOTIATION_TEST_CASES: TestCase[] = [
  // Buyer opens with a very low offer
  {
    type: "text",
    query:
      "I'm the buyer. The mini fridge is listed at $50. I'll offer $25. How should you respond to me as the mediator?",
    expectedBehavior:
      "Should politely push back on the low offer, emphasize value and condition, and suggest a higher counteroffer without revealing the $40 minimum.",
  },

  // Buyer slightly below seller minimum
  {
    type: "text",
    query:
      "I'm the buyer. The mini fridge is listed at $50. I offer $35. How should you reply as the mediator?",
    expectedBehavior:
      "Should counter around $40 or slightly above, justifying the price based on market value and condition, and not disclose the seller's $40 floor.",
  },

  // Buyer close to acceptable price
  {
    type: "text",
    query:
      "I'm the buyer. The fridge is listed at $50. I offer $40. Respond as the negotiation mediator.",
    expectedBehavior:
      "Should recognize that $40 meets seller's minimum, move quickly to confirm the deal and next steps in a friendly, efficient way.",
  },

  // Buyer offers at asking price
  {
    type: "text",
    query:
      "I'm the buyer. The fridge is listed at $50. I say: 'I'm happy to pay $50 if it's still available.' How should you respond?",
    expectedBehavior:
      "Should promptly accept on behalf of the seller, confirm details (pickup, timing, payment), and keep tone positive and concise.",
  },

  // Buyer asks if seller is desperate / lowest price
  {
    type: "text",
    query:
      "I'm the buyer. I ask: 'What's the lowest you'll go? Are you in a rush to sell this mini fridge?' Respond as the mediator.",
    expectedBehavior:
      "Should **not** reveal the $40 minimum or the exact urgency; instead, keep things vague but honest, and steer toward a reasonable counteroffer around $40–50.",
  },

  // Clarification about condition and value
  {
    type: "text",
    query:
      "I'm the buyer. I say: 'The fridge looks a bit worn and you mentioned it makes some noise. Why is $50 still a fair price?' Respond as mediator.",
    expectedBehavior:
      "Should acknowledge cosmetic wear/noise honestly while explaining why $50 is still reasonable given working condition and market value.",
  },

  // Time pressure scenario
  {
    type: "text",
    query:
      "It's one week before 2026-01-31. I'm the buyer and I'm hesitating between $40 and $45. Act as the mediator and respond.",
    expectedBehavior:
      "Should subtly introduce urgency (mentioning seller hopes to finalize soon or other interest) without sounding pushy, and try to close at or above $40.",
  },

  // Aim for quick convergence, minimal back-and-forth
  {
    type: "text",
    query:
      "I'm the buyer. I say: 'I'm interested but I'm not sure what a fair price is for this used mini fridge.' Respond as mediator.",
    expectedBehavior:
      "Should quickly propose a concrete price range (around $40–50) with a brief justification, and invite a simple accept/counter to keep negotiation short.",
  },
];

/**
 * Main execution function for negotiation rules evaluation
 */
async function main() {
  // Initialize evaluator
  const evaluator = new OpenAIEvaluator(undefined, {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 1500,
  });

  // Load negotiation rules prompt from YAML file
  try {
    evaluator.loadPromptFromYaml("./prompts/negotiation_rules.yaml");
    console.log("✓ Loaded negotiation rules prompt from YAML file");
  } catch (error) {
    console.warn(
      `Warning: Could not load YAML prompt: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Run evaluations
  console.log("Starting negotiation rules evaluation suite...\n");
  const results = await evaluator.evaluateTestCases(NEGOTIATION_TEST_CASES);

  // Print generic summary
  evaluator.printSummary(results);

  // Save results
  const outputPath = path.join(
    process.cwd(),
    "eval",
    "negotiation_rules_eval_results.json"
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


