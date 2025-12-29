import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

// Types
interface LeadPayload {
  email: string;
  first_name: string;
  last_name: string;
  moving_in_30_days: "yes" | "no";
  apartment_size: "studio" | "1br" | "2br" | "3br+";
  preferred_marketplaces: string[];
  notes?: string;
}

interface ApiResponse {
  ok: boolean;
  error?: string;
}

// Validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_MOVING = ["yes", "no"];
const VALID_SIZES = ["studio", "1br", "2br", "3br+"];
const VALID_MARKETPLACES = ["Facebook Marketplace", "Craigslist", "OfferUp", "eBay", "Poshmark", "Let us decide"];

function validatePayload(body: unknown): { valid: true; data: LeadPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const payload = body as Record<string, unknown>;

  // Email
  if (typeof payload.email !== "string" || !EMAIL_REGEX.test(payload.email)) {
    return { valid: false, error: "Invalid email address" };
  }

  // First name
  if (typeof payload.first_name !== "string" || !payload.first_name.trim()) {
    return { valid: false, error: "First name is required" };
  }

  // Last name
  if (typeof payload.last_name !== "string" || !payload.last_name.trim()) {
    return { valid: false, error: "Last name is required" };
  }

  // Moving in 30 days
  if (!VALID_MOVING.includes(payload.moving_in_30_days as string)) {
    return { valid: false, error: "moving_in_30_days must be 'yes' or 'no'" };
  }

  // Apartment size
  if (!VALID_SIZES.includes(payload.apartment_size as string)) {
    return { valid: false, error: "Invalid apartment_size" };
  }

  // Preferred marketplaces
  if (!Array.isArray(payload.preferred_marketplaces) || payload.preferred_marketplaces.length === 0) {
    return { valid: false, error: "Select at least one marketplace" };
  }

  // Notes (optional, trim and limit)
  let notes = "";
  if (payload.notes !== undefined && payload.notes !== null) {
    if (typeof payload.notes !== "string") {
      return { valid: false, error: "Notes must be a string" };
    }
    notes = payload.notes.trim().slice(0, 1000);
  }

  return {
    valid: true,
    data: {
      email: payload.email.trim().toLowerCase(),
      first_name: (payload.first_name as string).trim(),
      last_name: (payload.last_name as string).trim(),
      moving_in_30_days: payload.moving_in_30_days as "yes" | "no",
      apartment_size: payload.apartment_size as LeadPayload["apartment_size"],
      preferred_marketplaces: payload.preferred_marketplaces,
      notes,
    },
  };
}

// Google Sheets append
async function appendToSheet(data: LeadPayload, timestamp: string): Promise<void> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB || "Leads";

  if (!serviceAccountJson || !sheetId) {
    throw new Error("Missing Google Sheets configuration");
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("Failed to get access token");
  }

  const range = `${tabName}!A:I`;
  const values = [
    [
      timestamp,
      data.first_name,
      data.last_name,
      data.email,
      data.moving_in_30_days,
      data.apartment_size,
      data.preferred_marketplaces.join(", "),
      data.notes || "",
      "framer",
    ],
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sheets API error: ${response.status} ${errorText}`);
  }
}

// Slack notification
async function notifySlack(data: LeadPayload, timestamp: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("SLACK_WEBHOOK_URL not configured, skipping notification");
    return;
  }

  const message = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🆕 *New lead:* ${data.first_name} ${data.last_name} (${data.email})`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Moving in 30 days:*\n${data.moving_in_30_days}` },
          { type: "mrkdwn", text: `*Apartment size:*\n${data.apartment_size}` },
          { type: "mrkdwn", text: `*Marketplaces:*\n${data.preferred_marketplaces.join(", ")}` },
          { type: "mrkdwn", text: `*Timestamp:*\n${timestamp}` },
        ],
      },
      ...(data.notes
        ? [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Notes:*\n${data.notes}` },
            },
          ]
        : []),
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error(`Slack notification failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
}

// CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// POST handler
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const headers = corsHeaders();

  try {
    const body = await request.json();
    const validation = validatePayload(body);

    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400, headers });
    }

    const timestamp = new Date().toISOString();

    // Append to Google Sheets (required - fail if this fails)
    try {
      await appendToSheet(validation.data, timestamp);
    } catch (error) {
      console.error("Google Sheets error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to save lead. Please try again." },
        { status: 500, headers }
      );
    }

    // Send Slack notification (best effort)
    await notifySlack(validation.data, timestamp);

    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500, headers }
    );
  }
}
