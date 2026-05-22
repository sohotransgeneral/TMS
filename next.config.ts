import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl"],

  images: {
    remotePatterns: [
      // AWS S3
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      // Cloudflare R2
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      // Google (OAuth avatars)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Vercel Blob CDN
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },

  // Required for next-auth (bcrypt) in serverless environments
  serverExternalPackages: ["bcryptjs"],

  // Required for Auth.js v5 on Vercel — trusts the X-Forwarded-Host header
  // Also set AUTH_TRUST_HOST=true in Vercel environment variables
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000",
  },
};

export default nextConfig;
