import OpenAI from "openai";

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface ChatbotRequest {
  /**
   * Optional system prompt that sets behavior / context.
   * If omitted, a default system prompt is used.
   */
  systemPrompt?: string;

  /**
   * The current user message to send to the LLM.
   */
  userMessage: string;
}

interface ChatbotResponse {
  /**
   * Raw text output from the LLM.
   */
  output: string;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant for a marketplace app. " +
  "Answer clearly and concisely, focusing on helping the user understand how to list, find, and evaluate items.";

async function handleChatbotRequest(req: Request): Promise<Response> {
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

    const { systemPrompt, userMessage } = body as Partial<ChatbotRequest>;

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

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt && typeof systemPrompt === "string"
            ? systemPrompt
            : DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.7,
    });

    const output =
      completion.choices[0]?.message?.content?.toString().trim() ?? "";

    const responseBody: ChatbotResponse = {
      output,
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


