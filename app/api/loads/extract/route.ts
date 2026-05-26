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
const AI_MODEL = "gpt-5";

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
  "estimatedDistanceKm": number or null — for US documents extract the miles value directly (do NOT convert to km; US rate confirmations show miles),
  "internalNotes": "string or null — any other relevant info from the document"
}

Rules:
- Convert weight from lbs to kg if only lbs are given (1 lb = 0.453592 kg), round to 1 decimal
- If currency symbol $ is present assume USD
- If dates have no year, assume current year 2026
- Do not invent data — use null if unsure
- Return only the raw JSON, no markdown, no explanation`;

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
      max_completion_tokens: 4096,
    });

    const finishReason = response.choices[0]?.finish_reason;
    const raw = response.choices[0]?.message?.content ?? "";

    if (!raw) {
      return NextResponse.json({ error: "AI returned an empty response. Please try again." }, { status: 502 });
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
