/**
 * lib/r2.ts
 *
 * Cloudflare R2 — PRIVATE storage for sensitive documents.
 * Files are NOT publicly accessible; access is via presigned URLs (1 h expiry).
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
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
    forcePathStyle: true, // required for Cloudflare R2 — avoids virtual-hosted-style subdomain
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var not set");
  return bucket;
}

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/**
 * Upload a private file to R2.
 * Returns the R2 object KEY — never a public URL.
 * Use getSignedDownloadUrl(key) to grant time-limited access.
 */
export async function uploadPrivate(
  buffer: Buffer,
  originalName: string,
  subdir = "documents",
): Promise<{ key: string; sizeBytes: number }> {
  const ext = path.extname(originalName).toLowerCase();
  const key = `${subdir}/${crypto.randomUUID()}${ext}`;
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // NO ACL — bucket is private by default
    }),
  );

  return { key, sizeBytes: buffer.byteLength };
}

/**
 * Generate a presigned download URL for a private R2 object.
 * Default expiry: 1 hour.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return awsGetSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Delete a private R2 object by its key.
 */
export async function deletePrivate(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    );
  } catch {
    // ignore — file may not exist
  }
}
