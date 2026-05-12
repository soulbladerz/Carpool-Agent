import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../_lib";

// GET /api/v1/cars?area=KL&type=Sedan&max=200
// Returns all available cars whose owner is verified.
// Read-only endpoint for the parent system to integrate later.
export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const area = url.searchParams.get("area");
  const type = url.searchParams.get("type");
  const max = url.searchParams.get("max");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("cars")
    .select(
      "id, make, model, year, car_type, daily_rate, deposit, status, notes, " +
      "service_areas(area), owner:profiles!cars_owner_id_fkey(full_name, email, phone, is_verified)"
    )
    .eq("status", "available");

  if (type) query = query.eq("car_type", type);
  if (max) query = query.lte("daily_rate", Number(max));

  const { data, error } = await query;
  if (error) return json({ error: error.message }, { status: 500 });

  let result = (data ?? []).filter((c: any) => c.owner?.is_verified);
  if (area) {
    const needle = area.toLowerCase();
    result = result.filter((c: any) =>
      (c.service_areas ?? []).some((s: { area: string }) => s.area.toLowerCase().includes(needle))
    );
  }
  return json({ cars: result });
}
