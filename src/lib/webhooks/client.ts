/**
 * Browser-side helper to emit a webhook event after a successful Supabase RPC.
 *
 * Why this exists: the carpool app's webhook system (HMAC-signed delivery to
 * registered endpoints) lives behind /api/internal/emit, which is session-
 * authenticated. Server actions in /api/v1/* call emit() server-side, but the
 * UI talks to Postgres via supabase.rpc() directly — no server roundtrip,
 * no emit. This helper bridges the gap: it fires the event after the RPC
 * returns, so n8n (or any other subscriber) sees the action.
 *
 * Emit failures are logged but do NOT block the user. The DB write is the
 * source of truth; a missed notification is recoverable, a refused write
 * because the notifier failed would be a regression.
 */

import type { WebhookEvent } from "./emit";
export type { WebhookEvent };

export async function emitClientEvent(event: WebhookEvent, payload: Record<string, unknown>) {
  try {
    await fetch("/api/internal/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      // Fire-and-forget — don't await the response body, don't retry here.
      // Webhook retries are the subscriber's responsibility, and the /api
      // emit route never blocks on delivery (it spawns fanout in parallel).
      keepalive: true
    });
  } catch (err) {
    // Surface in dev tools but never throw. Notification failure must not
    // be visible to the user — their action already succeeded.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[webhook] client emit failed", event, err);
    }
  }
}
