/**
 * lib/storage.ts
 *
 * PUBLIC file storage — Vercel Blob (CDN, globally distributed).
 * Use this for logos, avatars, truck/trailer photos — files with no access restriction.
 *
 * For PRIVATE documents (CMR, POD, invoices, driver docs, etc.) use lib/r2.ts.
 *
 * Required env vars (auto-set by Vercel Blob integration):
 *   BLOB_READ_WRITE_TOKEN
 */

import { put, del } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/** Use Vercel Blob whenever the token is present (dev or prod), else fall back to local disk. */
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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
 * Save a public file.
 * - Production: uploads to Vercel Blob, returns CDN URL.
 * - Development: saves to public/uploads/<subdir>/, returns local path.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  subdir = "public"
): Promise<{ url: string; sizeBytes: number }> {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${crypto.randomUUID()}${ext}`;
  const pathname = `${subdir}/${filename}`;

  if (USE_BLOB) {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: getMimeType(ext),
    });
    return { url: blob.url, sizeBytes: buffer.byteLength };
  }

  // Development — local disk
  const dir = path.join(UPLOAD_DIR, subdir);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, filename), buffer);
  return { url: `/uploads/${subdir}/${filename}`, sizeBytes: buffer.byteLength };
}

/**
 * Delete a public file by its URL.
 * - Production: deletes from Vercel Blob.
 * - Development: deletes from local disk.
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    if (USE_BLOB) {
      await del(url);
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
