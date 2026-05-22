import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/webhooks/emit";

// POST /api/act/[token]  body: { action }
// No login: the token is the capability. Single-use, expiring, scoped to one target.
const ALLOWED: Record<string, string[]> = {
  offer_decision: ["accept", "reject"],
  booking_decision: ["confirm", "decline"],
  offer_create: ["make_offer", "decline"]
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

  let message = "";
  try {
    if (tok.kind === "offer_decision") {
      const { data: offer } = await admin.from("offers").select("request_id").eq("id", tok.target_id).single();
      if (!offer) throw new Error("That offer is no longer available.");
      if (action === "accept") {
        const { data: bookingId, error } = await admin.rpc("accept_offer", {
          p_offer_id: tok.target_id,
          p_acting_id: tok.member_id
        });
        if (error) throw new Error(error.message);
        await emit("offer.accepted", { request_id: offer.request_id, offer_id: tok.target_id, booking_id: bookingId });
        await emit("booking.created", { booking_id: bookingId });
        message = "Offer accepted — booking created. The owner has been notified to confirm.";
      } else {
        const { error } = await admin.rpc("reject_offer", { p_offer_id: tok.target_id, p_acting_id: tok.member_id });
        if (error) throw new Error(error.message);
        await emit("offer.rejected", { offer_id: tok.target_id, request_id: offer.request_id });
        message = "Offer rejected.";
      }
    } else if (tok.kind === "booking_decision") {
      if (action === "confirm") {
        const { error } = await admin.rpc("confirm_booking", { p_booking_id: tok.target_id, p_acting_id: tok.member_id });
        if (error) throw new Error(error.message);
        await emit("booking.confirmed", { booking_id: tok.target_id });
        message = "Booking confirmed. The renter has been notified.";
      } else {
        const { error } = await admin.rpc("cancel_booking", {
          p_booking_id: tok.target_id,
          p_reason: "Declined via link",
          p_acting_id: tok.member_id
        });
        if (error) throw new Error(error.message);
        await emit("booking.cancelled", { booking_id: tok.target_id, reason: "Declined" });
        message = "Booking declined and released. The other party has been notified.";
      }
    } else {
      // offer_create — owner responds to a direct request
      const { data: reqRow } = await admin.from("requests").select("status, car_id").eq("id", tok.target_id).single();
      if (!reqRow) throw new Error("That request no longer exists.");
      if (action === "make_offer") {
        if (reqRow.status !== "open") throw new Error("This request is no longer open.");
        if (!reqRow.car_id) throw new Error("This is not a direct request.");
        const { data: car } = await admin
          .from("cars")
          .select("owner_id, daily_rate, deposit")
          .eq("id", reqRow.car_id)
          .single();
        if (!car || car.owner_id !== tok.member_id) throw new Error("You don't own the requested car.");
        const { data: offer, error } = await admin
          .from("offers")
          .insert({
            request_id: tok.target_id,
            car_id: reqRow.car_id,
            offerer_id: tok.member_id,
            daily_rate: car.daily_rate,
            deposit: car.deposit,
            status: "pending"
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await emit("offer.created", { offer_id: offer.id, request_id: tok.target_id });
        message = "Offer sent. The requester has been notified — you'll be told if they accept.";
      } else {
        await admin
          .from("requests")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", tok.target_id)
          .eq("status", "open");
        message = "Declined. The request has been closed.";
      }
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "Could not complete that action.";
    return NextResponse.json({ error: m }, { status: 400 });
  }

  await admin.from("action_token").update({ used_at: new Date().toISOString() }).eq("token", token);
  return NextResponse.json({ ok: true, message });
}
