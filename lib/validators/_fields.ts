import { z } from "zod";

const optionalString = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => (v ? String(v).trim() : undefined))
  .optional();

const optionalNumber = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  })
  .optional();

const optionalDate = z
  .union([z.string(), z.date(), z.undefined(), z.null()])
  .transform((v) => {
    if (!v) return undefined;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? undefined : d;
  })
  .optional();

export const fields = { optionalString, optionalNumber, optionalDate };
