import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../../../_lib";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("offers")
    .select("id, request_id, car_id, offerer_id, daily_rate, deposit, notes, status, expires_at, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ offers: data ?? [] });
}
