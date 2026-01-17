import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface SendVerificationRequest {
  email: string;
}

interface SendVerificationResponse {
  success: boolean;
  message?: string;
  error?: string;
  devCode?: string; // Only included in dev mode (no RESEND_API_KEY)
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    const body: SendVerificationRequest = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`📧 Sending verification code to: ${email}`);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate verification code using the database function
    const { data: codeData, error: codeError } = await supabase.rpc(
      "create_verification_code",
      { p_email: email }
    );

    if (codeError) {
      console.error("Error creating verification code:", codeError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const verificationCode = codeData;
    console.log(`✅ Generated verification code for ${email}`);

    // Send email using Resend (or fallback to logging)
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Passive <noreply@passive.app>",
            to: [email],
            subject: "Your Passive verification code",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1A1917; font-size: 24px; margin-bottom: 20px;">Verify your email</h1>
                <p style="color: #6B6966; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                  Enter this code in the Passive app to continue:
                </p>
                <div style="background-color: #F5F3EF; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
                  <span style="font-size: 36px; font-weight: 600; letter-spacing: 8px; color: #1A1917;">${verificationCode}</span>
                </div>
                <p style="color: #9C9A97; font-size: 14px; line-height: 1.5;">
                  This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
                </p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error("Resend API error:", errorData);
        } else {
          console.log(`✉️ Verification email sent to ${email}`);
        }
      } catch (emailError) {
        console.error("Error sending email via Resend:", emailError);
        // Don't fail the request if email sending fails - the code is still valid
      }
    } else {
      // Log the code for development/testing
      console.log(`📋 [DEV] Verification code for ${email}: ${verificationCode}`);
    }

    const response: SendVerificationResponse = {
      success: true,
      message: "Verification code sent",
      // Include code in response for development (remove in production!)
      ...(resendApiKey ? {} : { devCode: verificationCode }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in sendVerificationEmail:", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
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
