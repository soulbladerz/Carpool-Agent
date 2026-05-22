import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, parseJsonBody, requireApiKey } from "../../../_lib";
import { rejectOfferSchema } from "../../../_schemas";
import { emit } from "@/lib/webhooks/emit";

// POST /api/v1/offers/[id]/reject
// body: { acting_email }  — acting_email must be the requester of the offer's request
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id: offerId } = await params;

  const parsed = await parseJsonBody(request, rejectOfferSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("id")
    .eq("email", body.acting_email)
    .single();
  if (!actor) return json({ error: "unknown acting_email" }, { status: 404 });

  const { data: offer } = await admin
    .from("offers")
    .select("id, request_id")
    .eq("id", offerId)
    .single();
  if (!offer) return json({ error: "unknown offer" }, { status: 404 });

  const { data: req } = await admin
    .from("requests")
    .select("requester_id")
    .eq("id", offer.request_id)
    .single();
  if (!req || req.requester_id !== actor.id) {
    return json({ error: "acting_email is not the requester" }, { status: 403 });
  }

  const { error } = await admin.rpc("reject_offer", {
    p_offer_id: offerId,
    p_acting_id: actor.id
  });
  if (error) return json({ error: error.message }, { status: 400 });

  await emit("offer.rejected", { offer_id: offerId, request_id: offer.request_id });
  return json({ ok: true });
}
