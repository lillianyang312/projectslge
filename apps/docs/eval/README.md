# OpenAI API Evaluation Suite

This evaluation suite allows you to automatically test prompts with example images and text queries from demo users of an online selling/buying app.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your OpenAI API key:**
   
   Create a `.env` file in the `docs` directory (same directory as `package.json`):
   ```bash
   # .env
   OPENAI_API_KEY=your-api-key-here
   ```
   
   The evaluator will automatically load the API key from this `.env` file.
   
   Alternatively, you can set it as an environment variable:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

## Usage

### Running the default evaluation suite

The suite includes example test cases for an online selling/buying app. Run it with:

```bash
npm run eval
```

Or directly:
```bash
ts-node eval/openai_api.ts
```

### Customizing test cases

Edit the `EXAMPLE_TEST_CASES` array in `openai_api.ts` to add your own test cases:

```typescript
export const EXAMPLE_TEST_CASES: TestCase[] = [
  {
    type: "image",
    imagePath: "../../../static/closet_example.jpg",
    query: "What items do you see in this image?",
    expectedBehavior: "Should identify items and provide specific details",
  },
  {
    type: "text",
    query: "I want to sell a MacBook Pro from 2022. What should I list it for?",
    expectedBehavior: "Should provide pricing suggestion with reasoning",
  },
  // Add more test cases...
];
```

### Using the evaluator programmatically

```typescript
import { OpenAIEvaluator, TestCase } from "./eval/openai_api";

// Initialize evaluator
const evaluator = new OpenAIEvaluator(undefined, {
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 1000,
});

// Load prompt from YAML
evaluator.loadPromptFromYaml("./prompts/general_personality.yaml");

// Define test cases
const testCases: TestCase[] = [
  {
    type: "image",
    imagePath: "./path/to/image.jpg",
    query: "What items are in this image?",
  },
];

// Run evaluations
const results = await evaluator.evaluateTestCases(testCases);

// Print summary
evaluator.printSummary(results);

// Save results
await evaluator.saveResults(results, "./eval_results.json");
```

## Configuration

The `OpenAIEvaluator` constructor accepts an optional configuration object:

```typescript
interface EvaluationConfig {
  model?: string;              // Default: "gpt-4o"
  temperature?: number;        // Default: 0.7
  maxTokens?: number;          // Default: 1000
  systemPrompt?: string;       // Default: ""
  promptTemplate?: string;     // Default: "{userQuery}"
}
```

## Output

The evaluation suite generates:
- Console output with progress and summary
- A JSON file (`eval_results.json`) containing detailed results for each test case

Each result includes:
- The test case (query and type)
- The prompt used
- The model's response
- Metadata (tokens used, latency, finish reason)
- Timestamp

## Test Case Types

### Image Query
```typescript
{
  type: "image",
  imagePath: "./path/to/image.jpg",
  query: "What items do you see?",
  expectedBehavior?: "Optional description of expected behavior"
}
```

### Text Query
```typescript
{
  type: "text",
  query: "I want to sell my laptop. What price should I set?",
  expectedBehavior?: "Optional description of expected behavior"
}
```

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Notes

- The evaluator automatically loads prompts from YAML files using the `yamlToPromptString` utility
- Image paths can be relative or absolute
- The suite continues evaluating other test cases even if one fails
- Results are saved in JSON format for further analysis

