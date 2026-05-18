import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, requireApiKey } from "../_lib";

// GET    /api/v1/webhooks       — list active subscriptions
// POST   /api/v1/webhooks       — body: { url, secret, event_types?: string[] }
// DELETE /api/v1/webhooks?id=…  — remove a subscription

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .select("id, url, event_types, is_active, last_delivery_at, last_status, created_at")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ endpoints: data ?? [] });
}

export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.url || !body?.secret) {
    return json({ error: "url and secret required" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .insert({
      url: body.url,
      secret: body.secret,
      event_types: Array.isArray(body.event_types) ? body.event_types : []
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("webhook_endpoints").delete().eq("id", id);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true });
}
