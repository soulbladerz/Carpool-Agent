import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, parseSearchParams, requireApiKey } from "../_lib";
import { carsQuerySchema } from "../_schemas";

// GET /api/v1/cars?area=KL&type=Sedan&max=200
// Returns all available cars whose owner is verified.
export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = parseSearchParams(url, carsQuerySchema);
  if (parsed.error) return parsed.error;
  const { area, type, max } = parsed.data;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("cars")
    .select(
      "id, make, model, year, car_type, daily_rate, deposit, status, notes, " +
      "service_areas(area), owner:profiles!cars_owner_id_fkey(full_name, email, phone, is_verified)"
    )
    .eq("status", "available");

  if (type) query = query.eq("car_type", type);
  if (max !== undefined) query = query.lte("daily_rate", max);

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
