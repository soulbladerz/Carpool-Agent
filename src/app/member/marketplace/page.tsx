import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";

type SearchParams = Promise<{ area?: string; type?: string; max?: string; from?: string; to?: string }>;

export default async function Marketplace({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireRole(["member", "admin"]);
  const { area, type, max, from, to } = await searchParams;

  // Parse window params. If parse fails or end <= start, treat as no window.
  let windowStart: Date | null = null;
  let windowEnd: Date | null = null;
  let windowError: string | null = null;
  if (from || to) {
    const fs = from ? new Date(from) : null;
    const fe = to ? new Date(to) : null;
    if (!fs || !fe || Number.isNaN(fs.getTime()) || Number.isNaN(fe.getTime())) {
      windowError = "Pick both a from and to date.";
    } else if (fe <= fs) {
      windowError = "End date must be after the start date.";
    } else {
      windowStart = fs;
      windowEnd = fe;
    }
  }

  let query = supabase
    .from("cars")
    .select(
      "id, owner_id, make, model, year, car_type, daily_rate, deposit, status, notes, photo_urls, " +
      "service_areas(area), owner:profiles!cars_owner_id_fkey(full_name, phone, is_verified)"
    )
    .eq("status", "available")
    .order("daily_rate", { ascending: true });

  if (type) query = query.eq("car_type", type);
  if (max) query = query.lte("daily_rate", Number(max));

  const { data: cars, error } = await query;

  let filtered = cars ?? [];
  if (area) {
    const needle = area.toLowerCase();
    filtered = filtered.filter((c: any) =>
      (c.service_areas ?? []).some((s: { area: string }) => s.area.toLowerCase().includes(needle))
    );
  }
  filtered = filtered.filter((c: any) => c.owner?.is_verified);

  const carIds = filtered.map((c: any) => c.id);

  // Two filters:
  //   1. Always hide cars in the middle of a rental right now.
  //   2. If a window was given, hide any car booked during that window.
  let blockedIds = new Set<string>();
  if (carIds.length) {
    if (windowStart && windowEnd) {
      const { data: blocked } = await supabase.rpc("cars_blocked_in_window", {
        p_car_ids: carIds,
        p_start_at: windowStart.toISOString(),
        p_end_at: windowEnd.toISOString()
      });
      blockedIds = new Set((blocked ?? []).map((b: any) => b.car_id));
    } else {
      const nowIso = new Date().toISOString();
      const { data: activeBookings } = await supabase
        .from("bookings")
        .select("car_id")
        .in("car_id", carIds)
        .in("status", ["confirmed", "in_progress"])
        .lte("start_at", nowIso)
        .gte("end_at", nowIso);
      blockedIds = new Set((activeBookings ?? []).map((b: any) => b.car_id));
    }
  }
  filtered = filtered.filter((c: any) => !blockedIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <Link href="/member/marketplace/requests" className="text-sm text-brand hover:underline">
          Browse open requests &rarr;
        </Link>
      </div>

      <form className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 card p-4">
        <input
          name="area"
          placeholder="Area (e.g. KL)"
          defaultValue={area ?? ""}
          className="input"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="input"
        >
          <option value="">Any type</option>
          {["Sedan", "SUV", "Hatchback", "Van", "Pickup", "Luxury", "Other"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          name="max"
          type="number"
          placeholder="Max rate (RM)"
          defaultValue={max ?? ""}
          className="input"
        />
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Available from</label>
          <input
            name="from"
            type="datetime-local"
            defaultValue={from ?? ""}
            className="input"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Until</label>
          <input
            name="to"
            type="datetime-local"
            defaultValue={to ?? ""}
            className="input"
          />
        </div>
        <button className="btn-primary text-sm">Filter</button>
      </form>

      {windowError && <p className="text-amber-700 text-sm">{windowError}</p>}
      {windowStart && windowEnd && (
        <p className="text-xs text-slate-500">
          Showing cars free between {windowStart.toLocaleString()} and {windowEnd.toLocaleString()}.
        </p>
      )}

      {error && <p className="text-red-600 text-sm">{error.message}</p>}

      {filtered.length === 0 ? (
        <p className="text-slate-500">No cars match your filters.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => {
            const isMine = c.owner_id === profile.id;
            return (
              <div key={c.id} className="card card-hover p-4 flex flex-col">
                {(c.photo_urls?.length ?? 0) > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_urls[0]} alt="" className="h-36 w-full object-cover rounded mb-3" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {c.make} {c.model} {c.year ? `(${c.year})` : ""}
                  </h3>
                  <span className="badge-green shrink-0"><span className="dot bg-brand-500" /> Available</span>
                </div>
                <p className="text-sm text-slate-500">{c.car_type}</p>

                <dl className="mt-3 text-sm grid grid-cols-2 gap-y-1">
                  <dt className="text-slate-500">Daily rate</dt><dd>{formatMYR(c.daily_rate)}</dd>
                  <dt className="text-slate-500">Deposit</dt><dd>{formatMYR(c.deposit)}</dd>
                </dl>
                <div className="mt-2 text-xs text-slate-500">
                  Service areas: {(c.service_areas ?? []).map((s: any) => s.area).join(", ") || "—"}
                </div>
                {c.notes && <p className="mt-2 text-sm text-slate-600">{c.notes}</p>}
                <p className="mt-2 text-xs text-slate-500">Owner: {c.owner?.full_name ?? "—"}</p>

                <div className="mt-auto pt-3">
                  {isMine ? (
                    <span className="block text-center text-xs text-slate-500 py-2">Your car</span>
                  ) : (
                    <Link
                      href={
                        `/member/requests/new?car_id=${c.id}` +
                        (windowStart && windowEnd
                          ? `&from=${encodeURIComponent(windowStart.toISOString())}&to=${encodeURIComponent(windowEnd.toISOString())}`
                          : "")
                      }
                      className="btn-primary w-full text-sm"
                    >
                      Request this car
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
