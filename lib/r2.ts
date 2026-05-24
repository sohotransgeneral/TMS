/**
 * lib/r2.ts
 *
 * Cloudflare R2 storage (S3-compatible API).
 * Used for company logos and other assets.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

function getClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 environment variables not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY)");
  }

  // R2 endpoint should be the account-level URL, without the bucket name
  // e.g. https://<account>.r2.cloudflarestorage.com  (NOT /bucket)
  const endpointUrl = endpoint.replace(/\/[^/]+\/?$/, "");

  return new S3Client({
    region,
    endpoint: endpointUrl,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var not set");
  return bucket;
}

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Upload a buffer to Cloudflare R2.
 * Returns the public URL (requires R2 bucket to have public access enabled).
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  subdir = "logos",
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${subdir}/${crypto.randomUUID()}${ext}`;
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    }),
  );

  // Public URL — R2 custom domain or the default r2.dev URL
  // The endpoint var contains the full bucket URL, so we can derive public URL
  const endpointBase = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
  return `${endpointBase}/${filename}`;
}

/**
 * Delete an object from R2 by its full public URL.
 */
export async function deleteFromR2(url: string): Promise<void> {
  try {
    const endpointBase = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
    const key = url.startsWith(endpointBase)
      ? url.slice(endpointBase.length + 1)
      : url.split("/").slice(-2).join("/");

    const client = getClient();
    const bucket = getBucket();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // ignore — file may not exist
  }
}
