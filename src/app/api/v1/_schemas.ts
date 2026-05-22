import { z } from "zod";

const isoDatetime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "must be an ISO datetime" });

export const createRequestSchema = z
  .object({
    requester_email: z.string().email(),
    car_id: z.string().uuid().nullish(),
    car_type: z.string().min(1).max(64).nullish(),
    pickup_area: z.string().min(1).max(200),
    start_at: isoDatetime,
    end_at: isoDatetime,
    passenger_count: z.number().int().positive().max(64),
    max_daily_rate: z.number().nonnegative().nullish(),
    notes: z.string().max(2000).nullish(),
    customer_name: z.string().min(1).max(200),
    customer_phone: z.string().min(3).max(64),
    customer_notes: z.string().max(2000).nullish()
  })
  .refine((v) => Date.parse(v.end_at) > Date.parse(v.start_at), {
    message: "end_at must be after start_at",
    path: ["end_at"]
  });

export const listRequestsQuerySchema = z.object({
  status: z.enum(["open", "matched", "fulfilled", "cancelled", "expired"]).optional()
});

export const acceptOfferSchema = z.object({
  offer_id: z.string().uuid(),
  acting_email: z.string().email()
});

export const rejectOfferSchema = z.object({
  acting_email: z.string().email()
});

export const bookingActionSchema = z.object({
  acting_email: z.string().email(),
  reason: z.string().max(500).optional()
});

export const webhookCreateSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16).max(256),
  event_types: z.array(z.string()).optional()
});

export const carsQuerySchema = z.object({
  area: z.string().max(200).optional(),
  type: z.string().max(64).optional(),
  max: z.coerce.number().nonnegative().optional()
});
