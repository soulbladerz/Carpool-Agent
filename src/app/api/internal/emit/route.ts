import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emit, type WebhookEvent } from "@/lib/webhooks/emit";

const ALLOWED: ReadonlySet<WebhookEvent> = new Set<WebhookEvent>([
  "request.created",
  "request.cancelled",
  "offer.created",
  "offer.accepted",
  "offer.rejected",
  "booking.created",
  "booking.confirmed",
  "booking.cancelled",
  "booking.started",
  "booking.completed"
]);

// Fire-and-forget endpoint that lets client components emit webhook events
// after a successful Supabase RPC. Authenticated via the user's session cookie
// so the API key never reaches the browser.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.event || !ALLOWED.has(body.event)) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  await emit(body.event, { ...body.payload, actor_id: user.id });
  return NextResponse.json({ ok: true });
}
