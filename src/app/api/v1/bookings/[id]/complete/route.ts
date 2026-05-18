import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../../../_lib";
import { emit } from "@/lib/webhooks/emit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.acting_email) return json({ error: "acting_email required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: actor } = await admin.from("profiles").select("id").eq("email", body.acting_email).single();
  if (!actor) return json({ error: "unknown acting_email" }, { status: 404 });

  const { error } = await admin.rpc("complete_booking", { p_booking_id: id, p_acting_id: actor.id });
  if (error) return json({ error: error.message }, { status: 400 });

  await emit("booking.completed", { booking_id: id });
  return json({ ok: true });
}
