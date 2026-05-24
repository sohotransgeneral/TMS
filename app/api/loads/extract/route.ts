import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requirePermission } from "@/lib/session";

const SYSTEM_PROMPT = `You are a logistics assistant. Extract transport load information from the provided document (rate confirmation, BOL, shipper's order, or similar).

Return ONLY a valid JSON object with these fields (use null for missing values):
{
  "customerId": null,
  "customerName": "string or null — company name of the shipper/customer",
  "pickupAddress": "string — full street address",
  "pickupCity": "string or null",
  "pickupCountry": "string or null — 2-letter code if possible e.g. US",
  "pickupDate": "ISO8601 datetime string or null",
  "pickupNotes": "string or null — special instructions at pickup",
  "deliveryAddress": "string — full street address",
  "deliveryCity": "string or null",
  "deliveryCountry": "string or null — 2-letter code if possible",
  "deliveryDate": "ISO8601 datetime string or null",
  "deliveryNotes": "string or null — special instructions at delivery",
  "cargoDescription": "string or null",
  "weightKg": number or null,
  "weightLbs": number or null,
  "volumeM3": number or null,
  "packages": number or null,
  "temperature": "string or null — e.g. -18°C or 35-41°F",
  "isHazardous": false,
  "price": number or null,
  "currency": "USD",
  "estimatedDistanceKm": number or null,
  "internalNotes": "string or null — any other relevant info from the document"
}

Rules:
- Convert weight from lbs to kg if only lbs are given (1 lb = 0.453592 kg), round to 1 decimal
- If currency symbol $ is present assume USD
- If dates have no year, assume current year 2026
- Do not invent data — use null if unsure
- Return only the raw JSON, no markdown, no explanation`;

export async function POST(req: Request) {
  try {
    await requirePermission("loads:write");
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

    let content: OpenAI.Chat.ChatCompletionContentPart[];

    if (isImage) {
      content = [
        { type: "text", text: "Extract all transport load information from this document image." },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
        },
      ];
    } else {
      // PDF — extract text with pdf-parse, then send as text to GPT-4o
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      const pdfText = parsed.text?.trim() ?? "";
      if (!pdfText) {
        return NextResponse.json({ error: "Could not extract text from PDF. Try uploading an image instead." }, { status: 422 });
      }
      content = [
        {
          type: "text",
          text: `Extract all transport load information from the following PDF document text:\n\n${pdfText}`,
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 1024,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const extracted = JSON.parse(cleaned);

    return NextResponse.json({ ok: true, data: extracted });
  } catch (err) {
    console.error("OpenAI extract error:", err);
    const msg = err instanceof Error ? err.message : "AI extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
