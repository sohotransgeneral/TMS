import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Pricing per 1M tokens (USD) — update if OpenAI changes pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5":          { input: 15.0,  output: 60.0 },
  "gpt-4o":         { input: 2.5,   output: 10.0 },
  "gpt-4.5-preview":{ input: 75.0,  output: 150.0 },
};
const BILLED_PER_EXTRACTION = 2.0; // $2 charged to company per AI extraction
const AI_MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are a meticulous logistics data extraction assistant. You will receive a transport document (rate confirmation, broker carrier confirmation, BOL, shipper's order, load tender, dispatch sheet, etc.) and must extract EVERY relevant data point with extreme attention to detail.

CRITICAL OUTPUT REQUIREMENT:
Return ONLY a raw JSON object — no markdown, no \`\`\`json fences, no commentary, no explanation. The JSON MUST contain ALL of these keys (use null when the document truly does not state the value — never invent data):

{
  "referenceNumber": "string or null — broker load #, PRO #, Order #, Shipment #, Job #, Reference # (NOT the BOL number unless that's the only ID). Strip prefixes like 'Load #' or 'Order:'.",
  "customerName": "string or null — the BROKER or SHIPPER's COMPANY NAME paying you (the one issuing the rate confirmation). NOT the carrier (you).",

  "pickupAddress": "string — full street address line of pickup (number + street). Do NOT include city/state/zip here — those go in their own fields.",
  "pickupCity": "string or null — pickup city only",
  "pickupState": "string or null — 2-letter US state code if applicable (TX, CA, OH, etc.)",
  "pickupZip": "string or null — pickup ZIP/postal code",
  "pickupCountry": "string or null — 2-letter country code (US, CA, MX, RO, DE, etc.); default US for US addresses",
  "pickupDate": "ISO8601 datetime string or null — the CALENDAR DATE of pickup only (e.g. '2026-06-15T00:00:00'). If the document shows a DATE (Mon 6/15, June 15, 06/15/2026) use that date. If ONLY a time window like '0700-1400' or '07:00 to 14:00' is given with no date, set pickupDate to null. Year defaults to 2026.",
  "pickupWindow": "string or null — ALWAYS extract ANY time range or time instruction here. Examples: '0700-1400', '07:00 to 14:00', 'FCFS 08:00-15:00', 'By Appt', 'ASAP', '09:00 appt', 'Open 6am-2pm'. Even if only one time is given (e.g. 'Appt 10:00') put it here. NEVER leave this null if there is any time information in the pickup section. Do NOT put time windows in pickupDate or pickupNotes.",
  "pickupContact": "string or null — person's name listed as pickup contact, dispatcher, shipping clerk, warehouse contact. NOT a company name.",
  "pickupPhone": "string or null — phone number for pickup location/contact, digits as written (e.g. '+1 713-555-0123'). Strip 'Tel:', 'Phone:' prefixes.",
  "pickupNotes": "string or null — ONLY truly special instructions: PU#, dock #, tarps required, PPE, driver-assist, lumper, freezer temp settings, gate codes, references like 'PU# HOUSTON TRANSFER'. Do NOT duplicate window/contact/phone here. Multiple notes separated by '; '.",

  "deliveryAddress": "string — full street address of delivery (number + street only)",
  "deliveryCity": "string or null",
  "deliveryState": "string or null — 2-letter US state code",
  "deliveryZip": "string or null",
  "deliveryCountry": "string or null — 2-letter code; default US",
  "deliveryDate": "ISO8601 datetime string or null — same rules as pickupDate",
  "deliveryWindow": "string or null — same as pickupWindow: ALWAYS extract any time range or time instruction here. '0700-1400', '07:00 to 14:00', 'FCFS', 'By Appt', 'ASAP', 'Close 15:00', etc. NEVER put time windows in deliveryDate or deliveryNotes.",
  "deliveryContact": "string or null — person's name for delivery contact",
  "deliveryPhone": "string or null — phone for delivery contact/location",
  "deliveryNotes": "string or null — only special delivery instructions (delivery #, appointment confirmations, dock, signature required, etc.)",

  "cargoDescription": "string or null — what is being hauled (e.g. 'Steel coils', 'Frozen chicken', 'Mixed pallets of electronics'). Combine multiple lines into one short phrase.",
  "weightLbs": number or null — weight in POUNDS as stated. Extract digits only (e.g. '42,500 lbs' → 42500).",
  "weightKg": number or null — weight in KG. ONLY fill if document states kg directly. If only lbs given, leave null (we compute it).",
  "volumeM3": number or null — volume in cubic meters if stated.",
  "packages": number or null — number of pallets/skids/cases/units (extract the count, e.g. '24 PLT' → 24)",
  "temperature": "string or null — reefer temp setting, e.g. '34°F', '-18°C', '35-41°F continuous'",
  "isHazardous": boolean — true ONLY if doc explicitly mentions HAZMAT, ADR, UN number, hazardous class, or DOT placards. Otherwise false.",
  "equipmentType": "string or null — e.g. 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Conestoga', 'Power Only'. Map abbreviations: V/Van→Dry Van, R→Reefer, F→Flatbed.",

  "price": number or null — total carrier pay / total rate / line haul + FSC summed. Extract numeric only (e.g. '$2,750.00' → 2750). If multiple totals shown, pick 'TOTAL', 'Total Carrier Pay', 'All-in Rate'.",
  "currency": "string — 3-letter ISO code: USD, EUR, RON, GBP, CAD, MXN. Default USD if '$' shown without other clues.",
  "estimatedDistanceKm": number or null — distance value as stated in the document. For US docs the number is in MILES — extract it as-is (do NOT convert). For EU docs already in km, also extract as-is.",
  "internalNotes": "string or null — any other useful info that doesn't fit elsewhere: detention terms, lumper instructions, accessorial rates, broker MC#, multi-stop summary, payment terms, special accessorials."
}

EXTRACTION RULES (read carefully):
1. SEPARATION: Always split window, contact, phone and special instructions into their OWN fields. Do NOT dump everything into pickupNotes/deliveryNotes. Example: if doc says "Pickup: 0700-1400 FCFS, Contact: John Smith 713-555-0123, PU# ABC123, Tarps required" then:
   - pickupWindow: "FCFS 0700-1400"
   - pickupContact: "John Smith"
   - pickupPhone: "713-555-0123"
   - pickupNotes: "PU# ABC123; Tarps required"
2. TIME WINDOWS ARE MANDATORY: Any pattern like "NNNN-NNNN", "NN:NN to NN:NN", "NN:NN-NN:NN", "FCFS", "By Appt", "ASAP", "Open until NN:NN" MUST go into pickupWindow / deliveryWindow. NEVER in pickupDate/deliveryDate (dates are calendar days, not time-of-day ranges). NEVER in notes.
3. MULTI-STOP: If the document has multiple pickups or deliveries, use the FIRST pickup and the LAST delivery for the main fields, and summarize the intermediate stops in internalNotes.
3. MULTI-STOP: If the document has multiple pickups or deliveries, use the FIRST pickup and the LAST delivery for the main fields, and summarize the intermediate stops in internalNotes.
4. ADDRESSES: keep street address clean (no city/state in pickupAddress). Always extract state code separately for US.
5. DATES: prefer ISO8601 with time when known. If only a date is given (no time) use the date with T00:00:00. Years default to 2026 if missing.
6. PHONES: extract just the number with original formatting; ignore extension if it's a major hassle.
7. NUMBERS: strip commas, currency symbols, units. price/weight/distance/packages are numeric — no strings. For weight: ALWAYS fill weightLbs if document shows pounds (lbs, LBS, lb, LB). Fill weightKg ONLY if document explicitly states kg/KG. Never leave both null if a weight is visible.
8. NEVER GUESS: if a value isn't in the document, return null. Better null than wrong data.
9. CASE: keep proper case for names and addresses (don't UPPERCASE unless source is UPPERCASE).

Now extract.`;

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requirePermission>>;
  try {
    me = await requirePermission("loads:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: "Only images and PDFs are supported" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any[];

    if (isImage) {
      content = [
        { type: "text", text: "Extract all transport load information from this document." },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
        },
      ];
    } else {
      // PDF — upload to OpenAI Files API first, then reference by file_id
      const uploadedFile = await openai.files.create({
        file: new File([buffer], file.name || "document.pdf", { type: "application/pdf" }),
        purpose: "user_data",
      });
      content = [
        { type: "text", text: "Extract all transport load information from this document." },
        {
          type: "file",
          file: { file_id: uploadedFile.id },
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_completion_tokens: 8192,
    });

    const finishReason = response.choices[0]?.finish_reason;
    const raw = response.choices[0]?.message?.content ?? "";

    console.log("[extract] model:", AI_MODEL, "finish:", finishReason, "raw length:", raw.length, "choices:", response.choices.length);

    if (!raw) {
      const detail = `finish_reason=${finishReason ?? "none"}, choices=${response.choices.length}, usage=${JSON.stringify(response.usage)}`;
      console.error("[extract] Empty response:", detail);
      return NextResponse.json({ error: `AI returned an empty response (${detail}). Please try again.` }, { status: 502 });
    }

    if (finishReason === "length") {
      // Response was truncated — try to salvage by closing open JSON object
      console.warn("OpenAI response truncated (finish_reason=length)");
    }

    // Strip markdown code fences if present
    let cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    // Extract first JSON object in case there's surrounding text
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse failed. Raw response:", raw);
      return NextResponse.json(
        { error: "AI response could not be parsed. The document may be too complex or the response was cut off. Try a clearer image." },
        { status: 422 }
      );
    }

    // Log AI usage for billing
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const pricing = MODEL_PRICING[AI_MODEL] ?? { input: 15.0, output: 60.0 };
    const realCostUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

    await prisma.aiUsageLog.create({
      data: {
        companyId: me.companyId ?? null,
        userId: me.id ?? null,
        model: AI_MODEL,
        fileType: isImage ? "image" : "pdf",
        inputTokens,
        outputTokens,
        realCostUsd,
        billedUsd: BILLED_PER_EXTRACTION,
      },
    });

    return NextResponse.json({ ok: true, data: extracted });
  } catch (err) {
    console.error("OpenAI extract error:", err);
    const msg = err instanceof Error ? err.message : "AI extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
