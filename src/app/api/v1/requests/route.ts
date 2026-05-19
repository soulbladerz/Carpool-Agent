import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, parseJsonBody, parseSearchParams, requireApiKey } from "../_lib";
import { createRequestSchema, listRequestsQuerySchema } from "../_schemas";
import { emit } from "@/lib/webhooks/emit";

// GET  /api/v1/requests?status=open
// POST /api/v1/requests   (see createRequestSchema)
export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = parseSearchParams(url, listRequestsQuerySchema);
  if (parsed.error) return parsed.error;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("requests")
    .select("id, requester_id, car_id, car_type, pickup_area, start_at, end_at, passenger_count, max_daily_rate, notes, status, expires_at, created_at")
    .order("created_at", { ascending: false });
  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  const { data, error } = await query;
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, createRequestSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: requester } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", body.requester_email)
    .single();
  if (!requester) {
    return json({ error: `unknown requester_email: ${body.requester_email}` }, { status: 404 });
  }
  if (requester.role !== "member" && requester.role !== "admin") {
    return json({ error: "requester is not a member" }, { status: 403 });
  }

  const { data: requestId, error: rpcError } = await admin.rpc("create_request", {
    p_car_id: body.car_id ?? null,
    p_car_type: body.car_type ?? null,
    p_pickup_area: body.pickup_area,
    p_start_at: body.start_at,
    p_end_at: body.end_at,
    p_passenger_count: body.passenger_count,
    p_max_daily_rate: body.max_daily_rate ?? null,
    p_notes: body.notes ?? null,
    p_customer_name: body.customer_name,
    p_customer_phone: body.customer_phone,
    p_customer_notes: body.customer_notes ?? null,
    p_acting_id: requester.id
  });
  if (rpcError || !requestId) {
    return json({ error: rpcError?.message ?? "insert failed" }, { status: 500 });
  }

  await emit("request.created", { request_id: requestId, requester_id: requester.id });
  return json({ request_id: requestId }, { status: 201 });
}
