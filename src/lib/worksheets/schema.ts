import { z } from "zod";

export const workSheetPayloadSchema = z.object({
  workDate: z.string().max(10),
  client: z.string().trim().max(180),
  company: z.string().trim().max(180),
  installer: z.string().trim().max(180),
  eventId: z.string().trim().max(80),
  mainInstallations: z.string().max(10_000),
  otherMaterials: z.string().max(5_000),
  reportText: z.string().max(30_000),
  reportFrozen: z.boolean(),
  selections: z.array(z.object({
    materialId: z.string().min(1),
    selected: z.boolean(),
    variantId: z.string(),
    quantity: z.number().min(0).max(100_000),
    detailValue: z.number().min(0).max(100_000),
    supplier: z.enum(["INTERNAL", "COMPANY"]),
    installed: z.boolean(),
  })).max(500),
});
