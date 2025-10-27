import { z } from "zod";

const logoSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      // Accept absolute URLs
      void new URL(value);
      return true;
    } catch (error) {
      // Fall back to allowing site-relative paths (e.g. /uploads/file.png)
      return value.startsWith("/");
    }
  }, { message: "Logo must be a valid URL or start with '/'." })
  .optional()
  .or(z.literal(""));

export const schoolQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
});

export const schoolCreateSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  country: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  principal: z.string().trim().min(1),
  established: z.string().trim().min(1),
  logo: logoSchema.optional(),
});

export const schoolUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    country: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    principal: z.string().trim().min(1).optional(),
    established: z.string().trim().min(1).optional(),
    logo: logoSchema.or(z.literal(null)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });
