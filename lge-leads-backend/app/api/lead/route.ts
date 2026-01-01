import { NextRequest, NextResponse } from "next/server"
import { GoogleAuth } from "google-auth-library"

/* =========================
   Types
========================= */

interface LeadPayload {
  email: string
  first_name: string
  last_name: string
  neighborhood: string
  notes?: string
}

interface ApiResponse {
  ok: boolean
  error?: string
}

/* =========================
   Validation
========================= */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePayload(
  body: unknown
): { valid: true; data: LeadPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" }
  }

  const payload = body as Record<string, unknown>

  if (typeof payload.email !== "string" || !EMAIL_REGEX.test(payload.email)) {
    return { valid: false, error: "Invalid email address" }
  }

  if (typeof payload.first_name !== "string" || !payload.first_name.trim()) {
    return { valid: false, error: "First name is required" }
  }

  if (typeof payload.last_name !== "string" || !payload.last_name.trim()) {
    return { valid: false, error: "Last name is required" }
  }

  if (typeof payload.neighborhood !== "string" || !payload.neighborhood.trim()) {
    return { valid: false, error: "Neighborhood is required" }
  }

  let notes = ""
  if (payload.notes !== undefined) {
    if (typeof payload.notes !== "string") {
      return { valid: false, error: "Notes must be a string" }
    }
    notes = payload.notes.trim().slice(0, 1000)
  }

  return {
    valid: true,
    data: {
      email: payload.email.trim().toLowerCase(),
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      neighborhood: payload.neighborhood.trim(),
      notes,
    },
  }
}

/* =========================
   Google Sheets
========================= */

async function appendToSheet(data: LeadPayload, timestamp: string): Promise<void> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const sheetId = process.env.GOOGLE_SHEET_ID
  const tabName = process.env.GOOGLE_SHEET_TAB || "Leads"

  if (!serviceAccountJson || !sheetId) {
    throw new Error("Missing Google Sheets configuration")
  }

  const credentials = JSON.parse(serviceAccountJson)
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  const client = await auth.getClient()
  const token = await client.getAccessToken()

  if (!token.token) {
    throw new Error("Failed to get access token")
  }

  const range = `${tabName}!A:F`
  const values = [
    [
      timestamp,
      data.first_name,
      data.last_name,
      data.email,
      data.neighborhood,
      data.notes || "",
    ],
  ]

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sheets API error: ${response.status} ${errorText}`)
  }
}

/* =========================
   CORS
========================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

/* =========================
   POST
========================= */

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const headers = corsHeaders()

  try {
    const body = await request.json()
    const validation = validatePayload(body)

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400, headers }
      )
    }

    const timestamp = new Date().toISOString()

    await appendToSheet(validation.data, timestamp)

    return NextResponse.json({ ok: true }, { headers })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to save lead" },
      { status: 500, headers }
    )
  }
}
