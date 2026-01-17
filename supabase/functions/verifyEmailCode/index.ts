import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface VerifyCodeRequest {
  email: string;
  code: string;
}

interface VerifyCodeResponse {
  valid: boolean;
  message?: string;
  error?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS handling
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
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body: VerifyCodeRequest = await req.json();
    const { email, code } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ valid: false, error: "Email is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!code || typeof code !== "string" || code.length !== 6) {
      return new Response(
        JSON.stringify({ valid: false, error: "Valid 6-digit code is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`🔐 Verifying code for: ${email}`);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the code using the database function
    const { data: isValid, error: verifyError } = await supabase.rpc(
      "verify_email_code",
      { p_email: email, p_code: code }
    );

    if (verifyError) {
      console.error("Error verifying code:", verifyError);
      return new Response(
        JSON.stringify({ valid: false, error: "Verification failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const response: VerifyCodeResponse = {
      valid: isValid === true,
      message: isValid ? "Code verified successfully" : "Invalid or expired code",
    };

    console.log(`${isValid ? '✅' : '❌'} Code verification for ${email}: ${isValid ? 'valid' : 'invalid'}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in verifyEmailCode:", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error", details: message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
