import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/session";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const user = await getCurrentUser();
  const logoUrl = user?.company?.logoUrl;

  // If company has a logo, proxy it as the favicon
  if (logoUrl) {
    const res = await fetch(logoUrl);
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: { "Content-Type": "image/png" },
    });
  }

  // Default: truck emoji icon
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: "#2563eb",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
      }}
    >
      🚛
    </div>,
    { ...size },
  );
}
