import { json, requireApiKey } from "../_lib";

// Stub for outbound webhook subscription. In production, persist subscriptions
// and emit events (car.flagged, car.available, owner.verified) from triggers
// or server actions. For MVP this just acknowledges so integrators can wire
// against a stable URL ahead of time.
export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  return json({ ok: true, received: body });
}
