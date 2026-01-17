import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface CreateUserRequest {
  email: string;
  fullName: string;
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

    const body: CreateUserRequest = await req.json();
    const { email, fullName } = body;

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and fullName are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(`🔧 Creating/finding user: ${email}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists in auth.users
    const { data: usersData } = await supabase.auth.admin.listUsers();
    let existingUser = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log(`✅ User already exists in auth.users: ${existingUser.id}`);
      userId = existingUser.id;
    } else {
      // Create user in auth.users
      const password = Math.random().toString(36).slice(-16) + "Aa1!";
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !newUser?.user) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ success: false, error: createError?.message || "Failed to create user" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      console.log(`✅ Created new auth user: ${newUser.user.id}`);
      userId = newUser.user.id;
    }

    // Check if user_profile exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      // Create user_profile
      const { error: profileError } = await supabase.from("user_profiles").insert({
        id: userId,
        full_name: fullName,
        harvard_email: email.toLowerCase(),
        graduation_year: 2026,
        house: "Adams",
        email_verified: true,
        login_preference: "email_code",
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // Continue anyway - user exists in auth
      } else {
        console.log(`✅ Created user_profile for: ${userId}`);
      }
    } else {
      console.log(`✅ User profile already exists for: ${userId}`);
    }

    // Generate a session for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
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

    // Extract token and create session
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to extract token" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

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

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in,
          token_type: sessionData.session.token_type,
          user: sessionData.session.user,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error in createTestUser:", error);
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
