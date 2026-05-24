/**
 * lib/storage.ts
 *
 * Production: Cloudflare R2 (S3-compatible, 10 GB free).
 * Development: local filesystem under public/uploads/.
 *
 * Required env vars:
 *   S3_ENDPOINT   — full bucket URL e.g. https://<account>.r2.cloudflarestorage.com/<bucket>
 *   S3_ACCESS_KEY — R2 API token Access Key ID
 *   S3_SECRET_KEY — R2 API token Secret Access Key
 *   S3_BUCKET     — bucket name (e.g. "tms")
 *   S3_REGION     — "auto" for R2
 *
 * Public access: enable "Public Access" on the bucket in Cloudflare Dashboard.
 * The public URL will be: S3_ENDPOINT/<key>
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// ── R2 client (lazy — only created when needed in production) ─────────────────
let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT ?? "";
  const accessKeyId = process.env.S3_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.S3_SECRET_KEY ?? "";
  const region = process.env.S3_REGION ?? "auto";

  // Strip bucket name from endpoint to get the account-level S3 API URL
  // e.g. https://<account>.r2.cloudflarestorage.com/tms → https://<account>.r2.cloudflarestorage.com
  const apiEndpoint = endpoint.replace(/\/[^/]+\/?$/, "");

  _client = new S3Client({
    region,
    endpoint: apiEndpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function getBucket(): string {
  return process.env.S3_BUCKET ?? "tms";
}

/** Public URL base — S3_ENDPOINT already contains the bucket path */
function getPublicBase(): string {
  return (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
}

// ── Local dev helpers ─────────────────────────────────────────────────────────
async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // already exists
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a file buffer.
 * - Production: uploads to Cloudflare R2, returns public URL.
 * - Development: saves to public/uploads/<subdir>/, returns local path.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  subdir = "documents"
): Promise<{ url: string; sizeBytes: number }> {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${crypto.randomUUID()}${ext}`;
  const key = `${subdir}/${filename}`;

  if (IS_PRODUCTION) {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: getMimeType(ext),
        CacheControl: "public, max-age=31536000",
      })
    );
    return { url: `${getPublicBase()}/${key}`, sizeBytes: buffer.byteLength };
  }

  // Development — local disk
  const dir = path.join(UPLOAD_DIR, subdir);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, filename), buffer);
  return { url: `/uploads/${subdir}/${filename}`, sizeBytes: buffer.byteLength };
}

/**
 * Delete a file by its public URL.
 * - Production: deletes from R2.
 * - Development: deletes from local disk.
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    if (IS_PRODUCTION) {
      const base = getPublicBase();
      const key = url.startsWith(base) ? url.slice(base.length + 1) : url.split("/").slice(-2).join("/");
      await getR2Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
      return;
    }
    // Development — local disk
    const rel = url.startsWith("/") ? url.slice(1) : url;
    await fs.unlink(path.join(process.cwd(), "public", rel));
  } catch {
    // ignore — file may not exist
  }
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
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
  };
  return map[ext] ?? "application/octet-stream";
}
