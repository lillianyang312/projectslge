import { createClient } from '@supabase/supabase-js';

/**
 * Chatbot Smoke Test
 *
 * Verifies that the `chatbot` Supabase Edge Function is reachable
 * and returns a non-empty `output` string for a basic prompt.
 *
 * This is analogous in spirit to `scripts/supabase_smoke_test.ts`,
 * but focused specifically on the LLM routing endpoint.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

describe('chatbot_smoke_test', () => {
  it(
    'returns a non-empty output from the chatbot edge function',
    async () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        // If env vars are not set, skip the test rather than fail CI.
        console.warn(
          'Skipping chatbot_smoke_test: SUPABASE_URL or SUPABASE_ANON_KEY not set.'
        );
        return;
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data, error } = await supabase.functions.invoke<{
        output: string;
      }>('chatbot', {
        body: {
          userMessage: 'Say hello in one short sentence.',
        },
      });

      if (error) {
        throw error;
      }

      expect(data).toBeDefined();
      expect(typeof data!.output).toBe('string');
      expect(data!.output.trim().length).toBeGreaterThan(0);
    },
    30000
  );
});


