import { z } from "zod";
import { VENDOR_KINDS } from "@/lib/books/vendor-logic";

const email = z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(255)]);
export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1, "Add the vendor's name").max(120),
  kind: z.enum(VENDOR_KINDS).default("contractor"),
  email: email.optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  matchText: z.string().trim().max(400).optional().default(""),
  is1099: z.boolean().optional(),
  w9OnFile: z.boolean().optional(),
  notes: z.string().trim().max(4000).optional().default(""),
});
export const vendorPatchSchema = vendorCreateSchema.partial().extend({ archived: z.boolean().optional() });
