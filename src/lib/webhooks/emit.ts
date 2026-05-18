import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type WebhookEvent =
  | "request.created"
  | "request.cancelled"
  | "request.expired"
  | "offer.created"
  | "offer.accepted"
  | "offer.rejected"
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.started"
  | "booking.completed";

export async function emit(event: WebhookEvent, payload: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  const { data: endpoints } = await admin
    .from("webhook_endpoints")
    .select("id, url, secret, event_types, is_active")
    .eq("is_active", true);

  if (!endpoints?.length) return;

  const body = JSON.stringify({ event, payload, sent_at: new Date().toISOString() });

  await Promise.all(
    endpoints
      .filter((e) => e.event_types.length === 0 || e.event_types.includes(event))
      .map((e) => deliver(e.id, e.url, e.secret, event, body))
  );
}

async function deliver(id: string, url: string, secret: string, event: string, body: string) {
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  let status = 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-carpool-event": event,
        "x-carpool-signature": signature
      },
      body,
      keepalive: true
    });
    status = res.status;
  } catch {
    status = 0;
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("webhook_endpoints")
    .update({ last_delivery_at: new Date().toISOString(), last_status: status })
    .eq("id", id);
}
