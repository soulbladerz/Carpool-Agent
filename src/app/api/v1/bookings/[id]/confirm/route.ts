import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, parseJsonBody, requireApiKey } from "../../../_lib";
import { bookingActionSchema } from "../../../_schemas";
import { emit } from "@/lib/webhooks/emit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;

  const parsed = await parseJsonBody(request, bookingActionSchema);
  if (parsed.error) return parsed.error;

  const admin = createSupabaseAdminClient();
  const { data: actor } = await admin.from("profiles").select("id").eq("email", parsed.data.acting_email).single();
  if (!actor) return json({ error: "unknown acting_email" }, { status: 404 });

  const { error } = await admin.rpc("confirm_booking", { p_booking_id: id, p_acting_id: actor.id });
  if (error) return json({ error: error.message }, { status: 400 });

  await emit("booking.confirmed", { booking_id: id });
  return json({ ok: true });
}
