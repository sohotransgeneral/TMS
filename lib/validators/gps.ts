import { z } from "zod";

export const gpsPingSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  speed: z.coerce.number().min(0).max(300).optional(),
  heading: z.coerce.number().min(0).max(360).optional(),
  accuracy: z.coerce.number().min(0).optional(),
  loadId: z.string().optional(),
  recordedAt: z.coerce.date().optional(),
});

export type GpsPingInput = z.infer<typeof gpsPingSchema>;
