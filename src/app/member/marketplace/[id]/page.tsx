import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatMYR } from "@/lib/format";

const PHOTO_WEBHOOK = "https://n8n.xaltech.org/webhook/carpool-photos";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function CarDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data: car } = (await supabase
    .from("cars")
    .select(
      "id, owner_id, make, model, year, car_type, daily_rate, deposit, status, notes, photo_urls, " +
        "service_areas(area), owner:profiles!cars_owner_id_fkey(full_name, is_verified)"
    )
    .eq("id", id)
    .single()) as { data: any };
  if (!car) notFound();

  const isMine = car.owner_id === profile.id;
  const photos: string[] = car.photo_urls ?? [];
  const carName = `${car.make} ${car.model}${car.year ? ` (${car.year})` : ""}`;

  // "Send photos to my WhatsApp" — to the number on this account. Reuse/mint a token.
  let sendLink: string | null = null;
  if (photos.length > 0 && profile.phone) {
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("photo_token")
      .select("token")
      .eq("member_id", profile.id)
      .eq("car_id", id)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    let pt = existing?.token as string | undefined;
    if (!pt) {
      pt = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await admin.from("photo_token").insert({ token: pt, member_id: profile.id, car_id: id });
    }
    sendLink = `${PHOTO_WEBHOOK}?t=${pt}`;
  }

  const requestHref =
    `/member/requests/new?car_id=${car.id}` +
    (from && to ? `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href="/member/marketplace" className="text-sm text-slate-500 hover:text-slate-700">&larr; Back to marketplace</Link>

      {/* Gallery */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={carName}
              className={"w-full object-cover rounded-xl border border-slate-200 " + (i === 0 ? "col-span-2 sm:col-span-3 h-56" : "h-28")}
            />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-slate-400 text-sm">No photos for this car yet.</div>
      )}

      {/* Details */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{carName}</h1>
            <p className="text-slate-500">{car.car_type}</p>
          </div>
          {car.status === "available" ? (
            <span className="badge-green"><span className="dot bg-brand-500" /> Available</span>
          ) : (
            <span className="badge-slate capitalize">{car.status}</span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Daily rate</dt><dd className="font-medium">{formatMYR(car.daily_rate)}</dd>
          <dt className="text-slate-500">Deposit</dt><dd className="font-medium">{formatMYR(car.deposit)}</dd>
          <dt className="text-slate-500">Service areas</dt>
          <dd>{(car.service_areas ?? []).map((s: { area: string }) => s.area).join(", ") || "—"}</dd>
          <dt className="text-slate-500">Owner</dt><dd>{car.owner?.full_name ?? "—"}</dd>
        </dl>
        {car.notes && <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">{car.notes}</p>}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {isMine ? (
            <Link href={`/member/cars/${car.id}`} className="btn-outline">Edit your car</Link>
          ) : (
            <Link href={requestHref} className="btn-primary flex-1 justify-center">Request this car</Link>
          )}
          {sendLink && (
            <a href={sendLink} className="btn-outline flex-1 justify-center">📷 Send photos to my WhatsApp</a>
          )}
        </div>
        {sendLink && (
          <p className="text-xs text-slate-500">
            Sends these photos to your WhatsApp ({profile.phone}) so you can forward them to your customer.
          </p>
        )}
        {photos.length > 0 && !profile.phone && (
          <p className="text-xs text-amber-700">Add a phone number to your account to send photos to your WhatsApp.</p>
        )}
      </section>
    </div>
  );
}
