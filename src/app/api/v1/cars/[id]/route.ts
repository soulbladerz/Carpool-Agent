import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../../_lib";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("cars")
    .select(
      "id, make, model, year, car_type, daily_rate, deposit, status, notes, " +
      "service_areas(area), owner:profiles!cars_owner_id_fkey(full_name, email, phone, is_verified)"
    )
    .eq("id", id)
    .single();

  if (error) return json({ error: error.message }, { status: 404 });
  return json({ car: data });
}
