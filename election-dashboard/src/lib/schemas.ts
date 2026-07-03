import { z } from "zod";

const isAntibotSkipped = process.env.SKIP_ANTIBOT_CHECKS === "true" && process.env.NODE_ENV !== "production";

export const VoteRequestSchema = z.object({
  candidate_id: z.string().min(1),
  province_code: z.string().min(1),
  poll_id: z.string().min(1),
  device_token: z.string().min(8).max(64),
  turnstile_token: isAntibotSkipped ? z.string().optional() : z.string().min(1),
  pow_challenge: isAntibotSkipped ? z.string().optional() : z.string().min(1),
  pow_nonce: isAntibotSkipped ? z.number().int().optional() : z.number().int(),
});

export const AdminCreatePollSchema = z.object({
  action: z.literal("create_poll"),
  title: z.string().min(1).max(200),
  country: z.string().min(2).max(10).optional(),
  candidates: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().min(1).max(20),
        color2: z.string().max(20).optional(),
        photo_url: z.string().max(500).optional(),
      })
    )
    .min(2)
    .max(10),
});

export const AdminStartPollSchema = z.object({
  action: z.literal("start_poll"),
  poll_id: z.string().min(1),
});

export const AdminEndPollSchema = z.object({
  action: z.literal("end_poll"),
  poll_id: z.string().min(1),
});

export const AdminDeletePollSchema = z.object({
  action: z.literal("delete_poll"),
  poll_id: z.string().min(1),
});

export const AdminRequestSchema = z.discriminatedUnion("action", [
  AdminCreatePollSchema,
  AdminStartPollSchema,
  AdminEndPollSchema,
  AdminDeletePollSchema,
]);

export type VoteRequest = z.infer<typeof VoteRequestSchema>;
export type AdminRequest = z.infer<typeof AdminRequestSchema>;
