import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../_lib";
import { emit } from "@/lib/webhooks/emit";

// GET  /api/v1/requests?status=open
// POST /api/v1/requests   { requester_email, car_type?, pickup_area, start_at, end_at,
//                          passenger_count, max_daily_rate?, notes?,
//                          customer_name, customer_phone, customer_notes? }
export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("requests")
    .select("id, requester_id, car_id, car_type, pickup_area, start_at, end_at, passenger_count, max_daily_rate, notes, status, expires_at, created_at")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid body" }, { status: 400 });
  const required = ["requester_email", "pickup_area", "start_at", "end_at", "passenger_count", "customer_name", "customer_phone"];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === "") {
      return json({ error: `missing field: ${k}` }, { status: 400 });
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: requester, error: lookupErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", body.requester_email)
    .single();
  if (lookupErr || !requester) {
    return json({ error: `unknown requester_email: ${body.requester_email}` }, { status: 404 });
  }
  if (requester.role !== "member" && requester.role !== "admin") {
    return json({ error: "requester is not a member" }, { status: 403 });
  }

  const { data: req, error: insertErr } = await admin
    .from("requests")
    .insert({
      requester_id: requester.id,
      car_id: body.car_id ?? null,
      car_type: body.car_type ?? null,
      pickup_area: body.pickup_area,
      start_at: body.start_at,
      end_at: body.end_at,
      passenger_count: body.passenger_count,
      max_daily_rate: body.max_daily_rate ?? null,
      notes: body.notes ?? null
    })
    .select("id")
    .single();
  if (insertErr || !req) {
    return json({ error: insertErr?.message ?? "insert failed" }, { status: 500 });
  }

  const { error: privErr } = await admin.from("request_private").insert({
    request_id: req.id,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone,
    customer_notes: body.customer_notes ?? null
  });
  if (privErr) {
    return json({ error: privErr.message }, { status: 500 });
  }

  await emit("request.created", { request_id: req.id, requester_id: requester.id });
  return json({ request_id: req.id }, { status: 201 });
}
