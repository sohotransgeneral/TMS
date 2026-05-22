/**
 * lib/storage.ts
 *
 * Production (Vercel): uses @vercel/blob — files are stored in Vercel Blob CDN.
 * Development (local): falls back to local filesystem under public/uploads/.
 *
 * Environment variable required in production:
 *   BLOB_READ_WRITE_TOKEN  — from Vercel dashboard > Storage > Blob
 */

// ── Vercel Blob (production) ──────────────────────────────────────────────────
import { put, del } from "@vercel/blob";

// ── Local filesystem (development fallback) ───────────────────────────────────
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // already exists
  }
}

/**
 * Save a file buffer.
 * - Production: uploads to Vercel Blob, returns public CDN URL.
 * - Development: saves to public/uploads/<subdir>/, returns local path.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  subdir = "documents"
): Promise<{ url: string; sizeBytes: number }> {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${crypto.randomUUID()}${ext}`;

  if (IS_PRODUCTION) {
    const blob = await put(`${subdir}/${filename}`, buffer, {
      access: "public",
      contentType: getMimeType(ext),
    });
    return { url: blob.url, sizeBytes: buffer.byteLength };
  }

  // Development — local disk
  const dir = path.join(UPLOAD_DIR, subdir);
  await ensureDir(dir);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return { url: `/uploads/${subdir}/${filename}`, sizeBytes: buffer.byteLength };
}

/**
 * Delete a file by its URL.
 * - Production: deletes from Vercel Blob.
 * - Development: deletes from local public/uploads/.
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    if (IS_PRODUCTION) {
      await del(url);
      return;
    }
    // Development — local disk
    const rel = url.startsWith("/") ? url.slice(1) : url;
    const filePath = path.join(process.cwd(), "public", rel);
    await fs.unlink(filePath);
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
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? "application/octet-stream";
}
