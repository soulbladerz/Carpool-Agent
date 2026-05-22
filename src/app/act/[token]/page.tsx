import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatMYR } from "@/lib/format";
import ActButtons, { type ActionOption } from "./act-buttons";

// No-login action page. GET only renders context (safe against link-preview
// prefetch); the action fires on a button click (POST /api/act/[token]).
const PHOTO_WEBHOOK = "https://n8n.xaltech.org/webhook/carpool-photos";
const SITE = "https://carpool-agent.vercel.app";

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
  let actions: ActionOption[] = [];
  let note = "";
  let photos: string[] = [];
  let carId: string | null = null;

  if (tok.kind === "offer_create") {
    const { data: r } = (await admin
      .from("requests")
      .select(
        "status, pickup_area, start_at, end_at, passenger_count, max_daily_rate, car_id, " +
          "requester:profiles!requests_requester_id_fkey(full_name), " +
          "car:cars(make, model, year, photo_urls, daily_rate, deposit, owner_id)"
      )
      .eq("id", tok.target_id)
      .single()) as { data: any };
    if (!r) return <Notice title="Request unavailable" body="This request can no longer be actioned." />;
    carId = r.car_id ?? null;
    photos = r.car?.photo_urls ?? [];
    const carName = `${r.car?.make ?? ""} ${r.car?.model ?? ""}${r.car?.year ? ` (${r.car.year})` : ""}`.trim();
    title = "Direct request for your car";
    rows = [
      ["Requester", r.requester?.full_name ?? "A member"],
      ["Pickup", r.pickup_area ?? "—"],
      ["Dates", `${new Date(r.start_at).toLocaleDateString()} → ${new Date(r.end_at).toLocaleDateString()}`],
      ["Passengers", String(r.passenger_count ?? "—")],
      ["Your rate", `${formatMYR(r.car?.daily_rate)}/day · ${formatMYR(r.car?.deposit)} deposit`],
      ...(r.max_daily_rate != null ? ([["Their max", `${formatMYR(r.max_daily_rate)}/day`]] as [string, string][]) : [])
    ];
    if (r.status === "open") {
      actions = [
        { key: "make_offer", label: `Offer ${carName || "my car"}`, tone: "pos" },
        { key: "decline", label: "Decline", tone: "neg" }
      ];
    } else {
      note = `This request is ${r.status}.`;
    }
  } else if (tok.kind === "offer_decision") {
    const { data: o } = (await admin
      .from("offers")
      .select(
        "status, daily_rate, deposit, car_id, car:cars(make, model, year, photo_urls), " +
          "offerer:profiles!offers_offerer_id_fkey(full_name), " +
          "request:requests!offers_request_id_fkey(pickup_area)"
      )
      .eq("id", tok.target_id)
      .single()) as { data: any };
    if (!o) return <Notice title="Offer unavailable" body="This offer can no longer be actioned." />;
    carId = o.car_id ?? null;
    photos = o.car?.photo_urls ?? [];
    title = "Offer on your request";
    rows = [
      ["Car", `${o.car?.make ?? ""} ${o.car?.model ?? ""}${o.car?.year ? ` (${o.car.year})` : ""}`.trim()],
      ["From", o.offerer?.full_name ?? "A member"],
      ["Daily rate", formatMYR(o.daily_rate)],
      ["Deposit", formatMYR(o.deposit)],
      ["Pickup", o.request?.pickup_area ?? "—"]
    ];
    if (o.status === "pending") {
      actions = [
        { key: "accept", label: "Accept", tone: "pos" },
        { key: "reject", label: "Reject", tone: "neg" }
      ];
    } else {
      note = `This offer is already ${o.status}.`;
    }
  } else {
    const { data: b } = (await admin
      .from("bookings")
      .select(
        "status, start_at, end_at, pickup_area, daily_rate, car_id, car:cars(make, model, year, photo_urls), " +
          "booker:profiles!bookings_booker_id_fkey(full_name)"
      )
      .eq("id", tok.target_id)
      .single()) as { data: any };
    if (!b) return <Notice title="Booking unavailable" body="This booking can no longer be actioned." />;
    carId = b.car_id ?? null;
    photos = b.car?.photo_urls ?? [];
    title = b.status === "confirmed" ? "Your booking" : "Confirm booking";
    rows = [
      ["Car", `${b.car?.make ?? ""} ${b.car?.model ?? ""}${b.car?.year ? ` (${b.car.year})` : ""}`.trim()],
      ["Renter", b.booker?.full_name ?? "A member"],
      ["Dates", `${new Date(b.start_at).toLocaleDateString()} → ${new Date(b.end_at).toLocaleDateString()}`],
      ["Daily rate", formatMYR(b.daily_rate)],
      ["Pickup", b.pickup_area ?? "—"]
    ];
    if (b.status === "pending_owner_confirmation") {
      actions = [
        { key: "confirm", label: "Confirm", tone: "pos" },
        { key: "decline", label: "Decline", tone: "neg" }
      ];
    } else if (b.status === "confirmed") {
      actions = [{ key: "decline", label: "Cancel booking", tone: "neg" }];
    } else {
      note = `This booking is ${b.status}.`;
    }
  }

  // Photo sharing (offer + booking): reuse-or-mint a car-scoped token for the
  // WhatsApp send, plus a public shareable gallery link.
  let sendLink: string | null = null;
  let galleryLink: string | null = null;
  if (photos.length > 0 && carId && tok.kind !== "offer_create") {
    galleryLink = `${SITE}/car/${carId}/photos`;
    const { data: existing } = await admin
      .from("photo_token")
      .select("token")
      .eq("member_id", tok.member_id)
      .eq("car_id", carId)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    let pt = existing?.token as string | undefined;
    if (!pt) {
      pt = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await admin.from("photo_token").insert({ token: pt, member_id: tok.member_id, car_id: carId });
    }
    sendLink = `${PHOTO_WEBHOOK}?t=${pt}`;
  }

  return (
    <Card>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-slate-500">Acting as {member?.full_name ?? "you"}</p>
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 6).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="Car" className="h-20 w-full object-cover rounded border border-slate-200" />
            ))}
          </div>
          {sendLink && (
            <a href={sendLink} className="block text-center text-sm rounded-md border border-slate-300 py-2 hover:bg-slate-50">
              📷 Send these photos to my WhatsApp
            </a>
          )}
          {galleryLink && (
            <a
              href={galleryLink}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm rounded-md border border-slate-300 py-2 hover:bg-slate-50"
            >
              🔗 Shareable photo link (open / forward)
            </a>
          )}
        </div>
      )}

      <div className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-slate-500">{k}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      {actions.length > 0 ? <ActButtons token={tok.token} actions={actions} /> : <p className="text-sm text-slate-600">{note}</p>}
    </Card>
  );
}
