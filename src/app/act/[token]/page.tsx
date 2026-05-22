import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatMYR } from "@/lib/format";
import ActButtons from "./act-buttons";

// No-login action page. GET only renders context (safe against link-preview
// prefetch); the action fires on a button click (POST /api/act/[token]).
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">{children}</div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-slate-600">{body}</p>
    </Card>
  );
}

export default async function ActPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();

  const { data: tok } = await admin
    .from("action_token")
    .select("token, member_id, kind, target_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (!tok) return <Notice title="Link not found" body="This action link is invalid." />;
  if (tok.used_at) return <Notice title="Already done" body="This link has already been used." />;
  if (new Date(tok.expires_at) < new Date())
    return <Notice title="Link expired" body="Please open the app to take this action instead." />;

  const { data: member } = await admin.from("profiles").select("full_name").eq("id", tok.member_id).single();

  let title = "";
  let rows: [string, string][] = [];

  if (tok.kind === "offer_decision") {
    const { data: o } = (await admin
      .from("offers")
      .select(
        "daily_rate, deposit, car:cars(make, model, year), " +
          "offerer:profiles!offers_offerer_id_fkey(full_name), " +
          "request:requests!offers_request_id_fkey(pickup_area)"
      )
      .eq("id", tok.target_id)
      .single()) as { data: any };
    if (!o) return <Notice title="Offer unavailable" body="This offer can no longer be actioned." />;
    title = "Offer on your request";
    rows = [
      ["Car", `${o.car?.make ?? ""} ${o.car?.model ?? ""}${o.car?.year ? ` (${o.car.year})` : ""}`.trim()],
      ["From", o.offerer?.full_name ?? "A member"],
      ["Daily rate", formatMYR(o.daily_rate)],
      ["Deposit", formatMYR(o.deposit)],
      ["Pickup", o.request?.pickup_area ?? "—"]
    ];
  } else {
    const { data: b } = (await admin
      .from("bookings")
      .select(
        "start_at, end_at, pickup_area, daily_rate, car:cars(make, model, year), " +
          "booker:profiles!bookings_booker_id_fkey(full_name)"
      )
      .eq("id", tok.target_id)
      .single()) as { data: any };
    if (!b) return <Notice title="Booking unavailable" body="This booking can no longer be actioned." />;
    title = "Confirm booking";
    rows = [
      ["Car", `${b.car?.make ?? ""} ${b.car?.model ?? ""}${b.car?.year ? ` (${b.car.year})` : ""}`.trim()],
      ["Renter", b.booker?.full_name ?? "A member"],
      ["Dates", `${new Date(b.start_at).toLocaleDateString()} → ${new Date(b.end_at).toLocaleDateString()}`],
      ["Daily rate", formatMYR(b.daily_rate)],
      ["Pickup", b.pickup_area ?? "—"]
    ];
  }

  return (
    <Card>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-slate-500">Acting as {member?.full_name ?? "you"}</p>
      </div>
      <div className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-slate-500">{k}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      <ActButtons token={tok.token} kind={tok.kind} />
    </Card>
  );
}
