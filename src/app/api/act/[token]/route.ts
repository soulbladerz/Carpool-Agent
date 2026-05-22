import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/webhooks/emit";

// POST /api/act/[token]  body: { action: "accept" | "reject" | "confirm" | "decline" }
// No login: the token is the capability. Single-use, expiring, scoped to one target.
const ALLOWED: Record<string, string[]> = {
  offer_decision: ["accept", "reject"],
  booking_decision: ["confirm", "decline"]
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let action = "";
  try {
    action = ((await request.json()) as { action?: string })?.action ?? "";
  } catch {
    /* no body */
  }

  const admin = createSupabaseAdminClient();
  const { data: tok } = await admin
    .from("action_token")
    .select("token, member_id, kind, target_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (!tok) return NextResponse.json({ error: "This link is invalid." }, { status: 404 });
  if (tok.used_at) return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  if (new Date(tok.expires_at) < new Date())
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  if (!ALLOWED[tok.kind]?.includes(action))
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  try {
    if (action === "accept") {
      const { data: offer } = await admin.from("offers").select("request_id").eq("id", tok.target_id).single();
      if (!offer) throw new Error("That offer is no longer available.");
      const { data: bookingId, error } = await admin.rpc("accept_offer", {
        p_offer_id: tok.target_id,
        p_acting_id: tok.member_id
      });
      if (error) throw new Error(error.message);
      await emit("offer.accepted", { request_id: offer.request_id, offer_id: tok.target_id, booking_id: bookingId });
      await emit("booking.created", { booking_id: bookingId });
    } else if (action === "reject") {
      const { data: offer } = await admin.from("offers").select("request_id").eq("id", tok.target_id).single();
      const { error } = await admin.rpc("reject_offer", { p_offer_id: tok.target_id, p_acting_id: tok.member_id });
      if (error) throw new Error(error.message);
      await emit("offer.rejected", { offer_id: tok.target_id, request_id: offer?.request_id });
    } else if (action === "confirm") {
      const { error } = await admin.rpc("confirm_booking", { p_booking_id: tok.target_id, p_acting_id: tok.member_id });
      if (error) throw new Error(error.message);
      await emit("booking.confirmed", { booking_id: tok.target_id });
    } else {
      const { error } = await admin.rpc("cancel_booking", {
        p_booking_id: tok.target_id,
        p_reason: "Declined via link",
        p_acting_id: tok.member_id
      });
      if (error) throw new Error(error.message);
      await emit("booking.cancelled", { booking_id: tok.target_id, reason: "Declined" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not complete that action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await admin.from("action_token").update({ used_at: new Date().toISOString() }).eq("token", token);

  const messages: Record<string, string> = {
    accept: "Offer accepted — booking created. The owner has been notified to confirm.",
    reject: "Offer rejected.",
    confirm: "Booking confirmed. The renter has been notified.",
    decline: "Booking declined and released. The other party has been notified."
  };
  return NextResponse.json({ ok: true, message: messages[action] });
}
