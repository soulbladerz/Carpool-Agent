import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";

type SearchParams = Promise<{ area?: string; type?: string; max?: string }>;

export default async function Marketplace({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireRole(["member", "admin"]);
  const { area, type, max } = await searchParams;

  let query = supabase
    .from("cars")
    .select(
      "id, owner_id, make, model, year, car_type, daily_rate, deposit, status, notes, " +
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

  // Decorate cars with their live booking state. A car may be flagged
  // `available` but in fact mid-rental — hide those.
  const carIds = filtered.map((c: any) => c.id);
  let rentedNowIds = new Set<string>();
  if (carIds.length) {
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("car_id")
      .in("car_id", carIds)
      .in("status", ["confirmed", "in_progress"])
      .lte("start_at", new Date().toISOString())
      .gte("end_at", new Date().toISOString());
    rentedNowIds = new Set((activeBookings ?? []).map((b: any) => b.car_id));
  }
  filtered = filtered.filter((c: any) => !rentedNowIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <Link href="/member/marketplace/requests" className="text-sm text-brand hover:underline">
          Browse open requests &rarr;
        </Link>
      </div>

      <form className="grid sm:grid-cols-4 gap-2 bg-white p-4 rounded-lg border border-slate-200">
        <input
          name="area"
          placeholder="Area (e.g. KL)"
          defaultValue={area ?? ""}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Any type</option>
          {["Sedan", "SUV", "Hatchback", "Van", "Pickup", "Luxury", "Other"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          name="max"
          type="number"
          placeholder="Max daily rate"
          defaultValue={max ?? ""}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded bg-brand text-white text-sm hover:bg-brand-dark">Filter</button>
      </form>

      {error && <p className="text-red-600 text-sm">{error.message}</p>}

      {filtered.length === 0 ? (
        <p className="text-slate-500">No cars match your filters.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => {
            const isMine = c.owner_id === profile.id;
            return (
              <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col">
                <h3 className="font-semibold">
                  {c.make} {c.model} {c.year ? `(${c.year})` : ""}
                </h3>
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
                      href={`/member/requests/new?car_id=${c.id}`}
                      className="block w-full text-center rounded bg-brand text-white text-sm py-2 hover:bg-brand-dark"
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
