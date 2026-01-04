// pages/api/lead.ts
import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

const REQUIRED = [
  "email",
  "first_name",
  "last_name",
  "age",
  "city",
  "state",
  "neighborhood",
  "example_item",
  "sold_secondhand_before",
  "sell_priority",
  "offer_trigger",
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"]
  if (typeof xf === "string") return xf.split(",")[0].trim()
  return (req.socket as any)?.remoteAddress || ""
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" })

  try {
    const b = req.body ?? {}

    const email = String(b.email ?? "").trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "Invalid email" })

    // Required checks (lightweight)
    for (const k of REQUIRED) {
      if (b[k] === undefined || b[k] === null || String(b[k]).trim() === "") {
        return res.status(400).json({ ok: false, error: `Missing: ${k}` })
      }
    }

    const ageNum = Number(b.age)
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      return res.status(400).json({ ok: false, error: "Invalid age" })
    }

    const sellableStatesArr: string[] = Array.isArray(b.sellable_states) ? b.sellable_states : []
    const sellableStates = sellableStatesArr.map(String).filter(Boolean).join("|")

    const row = [
      new Date().toISOString(),                // created_at
      email,                                   // email
      String(b.first_name).trim(),             // first_name
      String(b.last_name).trim(),              // last_name
      String(Math.trunc(ageNum)),              // age
      String(b.city).trim(),                   // city
      String(b.state).trim(),                  // state
      String(b.neighborhood).trim(),           // neighborhood
      sellableStates,                          // sellable_states
      String(b.sellable_other_text ?? "").trim(), // sellable_other_text
      String(b.offer_trigger ?? "").trim(),    // offer_trigger
      String(b.offer_other_text ?? "").trim(), // offer_other_text
      String(b.example_item ?? "").trim(),     // example_item
      String(b.sold_secondhand_before ?? "").trim(), // sold_secondhand_before
      String(b.sell_priority ?? "").trim(),    // sell_priority
      String(b.sell_priority_other_text ?? "").trim(), // sell_priority_other_text
      String(b.notes ?? "").trim(),            // notes
      String(req.headers["user-agent"] ?? ""), // user_agent
      getClientIp(req),                        // ip
    ]

    // --- Google Sheets append ---
    // ENV you must set in Vercel:
    // GOOGLE_SERVICE_ACCOUNT_EMAIL
    // GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (replace \n properly)
    // GOOGLE_SHEETS_ID
    // GOOGLE_SHEETS_RANGE  e.g. "Leads!A:S"
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: process.env.GOOGLE_SHEETS_RANGE || "Leads!A:S",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    })

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" })
  }
}
