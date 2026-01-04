// pages/api/lead.ts
import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"]
  if (typeof xf === "string") return xf.split(",")[0].trim()
  return (req.socket as any)?.remoteAddress || ""
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    const b = req.body ?? {}

    const email = String(b.email ?? "").trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" })
    }

    const first = String(b.first_name ?? "").trim()
    const last = String(b.last_name ?? "").trim()
    const city = String(b.city ?? "").trim()
    const state = String(b.state ?? "").trim()
    const neighborhood = String(b.neighborhood ?? "").trim()

    if (!first || !last || !city || !state || !neighborhood) {
      return res.status(400).json({ ok: false, error: "Missing required fields" })
    }

    const ageNum = Number(b.age)
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      return res.status(400).json({ ok: false, error: "Invalid age" })
    }

    const homeStatesArr: string[] = Array.isArray(b.home_states) ? b.home_states : []
    const categoriesArr: string[] = Array.isArray(b.categories) ? b.categories : []

    const home_states = homeStatesArr.map(String).filter(Boolean).join("|")
    const categories = categoriesArr.map(String).filter(Boolean).join("|")

    const row = [
      new Date().toISOString(),                    // created_at
      email,                                       // email
      first,                                       // first_name
      last,                                        // last_name
      String(Math.trunc(ageNum)),                  // age
      city,                                        // city
      state,                                       // state
      neighborhood,                                // neighborhood
      home_states,                                 // home_states
      String(b.home_other_text ?? "").trim(),      // home_other_text
      String(b.blocker ?? "").trim(),              // blocker
      String(b.blocker_other_text ?? "").trim(),   // blocker_other_text
      categories,                                  // categories
      String(b.category_other_text ?? "").trim(),  // category_other_text
      String(b.example_item ?? "").trim(),         // example_item
      String(b.notes ?? "").trim(),                // notes
      String(req.headers["user-agent"] ?? ""),     // user_agent
      getClientIp(req),                            // ip
    ]

    // Required env vars in Vercel:
    // GOOGLE_SERVICE_ACCOUNT_EMAIL
    // GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (store with \n escaped, we convert below)
    // GOOGLE_SHEETS_ID
    // GOOGLE_SHEETS_RANGE  e.g. "Leads!A:R"
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: process.env.GOOGLE_SHEETS_RANGE || "Leads!A:R",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    })

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" })
  }
}
