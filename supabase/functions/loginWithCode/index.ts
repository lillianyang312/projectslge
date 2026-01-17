import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface LoginRequest {
  email: string;
  code: string;
}

interface LoginResponse {
  success: boolean;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user: any;
  };
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
        JSON.stringify({ success: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body: LoginRequest = await req.json();
    const { email, code } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
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
        JSON.stringify({ success: false, error: "Valid 6-digit code is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`🔐 Login attempt for: ${email}`);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First verify the code
    const { data: isValid, error: verifyError } = await supabase.rpc(
      "verify_email_code",
      { p_email: email, p_code: code }
    );

    if (verifyError) {
      console.error("Error verifying code:", verifyError);
      return new Response(
        JSON.stringify({ success: false, error: "Verification failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!isValid) {
      console.log(`❌ Invalid code for ${email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`✅ Code verified for ${email}`);

    // First try to find user by email in user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("harvard_email", email)
      .single();

    let authUser: any = null;

    if (profile) {
      // User found in user_profiles, get auth user by ID
      const { data, error: authError } = await supabase.auth.admin.getUserById(
        profile.id
      );
      if (!authError && data?.user) {
        authUser = data;
      }
    }

    // If not found in user_profiles, try to find directly in auth.users by email
    if (!authUser) {
      console.log(`User not in user_profiles, checking auth.users for: ${email}`);
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

      if (!listError && usersData?.users) {
        const foundUser = usersData.users.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (foundUser) {
          authUser = { user: foundUser };
          console.log(`Found user in auth.users: ${foundUser.id}`);
        }
      }
    }

    if (!authUser?.user) {
      console.error("User not found in user_profiles or auth.users");
      return new Response(
        JSON.stringify({ success: false, error: "Account not found. Please sign up first." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Generate a session for the user using admin API
    // We use magic link token generation internally
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email!,
    });

    if (linkError || !linkData) {
      console.error("Error generating link:", linkError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Extract the token from the link and verify it to create a session
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify the token to get a session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "magiclink",
    });

    if (sessionError || !sessionData.session) {
      console.error("Error creating session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`✅ Session created for ${email}`);

    const response: LoginResponse = {
      success: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in!,
        token_type: sessionData.session.token_type!,
        user: sessionData.session.user,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in loginWithCode:", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: message }),
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
