import "server-only";

/** A company logo as base64, ready for jsPDF's addImage. */
export type PdfLogo = { logoBase64: string; logoFormat: "PNG" | "JPEG" | "WEBP" };

export async function fetchLogoBase64(
  logoUrl: string | null | undefined,
): Promise<PdfLogo | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const format: PdfLogo["logoFormat"] = contentType.includes("png")
      ? "PNG"
      : contentType.includes("webp")
        ? "WEBP"
        : "JPEG";
    const buf = Buffer.from(await res.arrayBuffer());
    return { logoBase64: buf.toString("base64"), logoFormat: format };
  } catch {
    return null;
  }
}
