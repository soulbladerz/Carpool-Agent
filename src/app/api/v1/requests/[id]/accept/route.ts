import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, parseJsonBody, requireApiKey } from "../../../_lib";
import { acceptOfferSchema } from "../../../_schemas";
import { emit } from "@/lib/webhooks/emit";

// POST /api/v1/requests/[id]/accept
// body: { offer_id, acting_email }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id: requestId } = await params;

  const parsed = await parseJsonBody(request, acceptOfferSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("id")
    .eq("email", body.acting_email)
    .single();
  if (!actor) return json({ error: "unknown acting_email" }, { status: 404 });

  const { data: req } = await admin.from("requests").select("id, requester_id").eq("id", requestId).single();
  if (!req || req.requester_id !== actor.id) {
    return json({ error: "acting_email is not the requester" }, { status: 403 });
  }

  const { data: bookingId, error } = await admin.rpc("accept_offer", {
    p_offer_id: body.offer_id,
    p_acting_id: actor.id
  });
  if (error) return json({ error: error.message }, { status: 400 });

  await emit("offer.accepted", { request_id: requestId, offer_id: body.offer_id, booking_id: bookingId });
  await emit("booking.created", { booking_id: bookingId });
  return json({ booking_id: bookingId }, { status: 201 });
}
