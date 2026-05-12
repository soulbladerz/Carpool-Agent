import { requireRole } from "@/lib/auth";
import FlagButton from "./flag-button";

type SearchParams = Promise<{ area?: string; type?: string; max?: string }>;

export default async function AgentBrowse({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireRole(["agent", "admin"]);
  const { area, type, max } = await searchParams;

  let query = supabase
    .from("cars")
    .select(
      "id, make, model, year, car_type, daily_rate, deposit, status, notes, " +
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
  // Only show cars whose owner is verified (defense in depth alongside RLS).
  filtered = filtered.filter((c: any) => c.owner?.is_verified);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Available cars</h1>

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
          {filtered.map((c: any) => (
            <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col">
              <h3 className="font-semibold">
                {c.make} {c.model} {c.year ? `(${c.year})` : ""}
              </h3>
              <p className="text-sm text-slate-500">{c.car_type}</p>

              <dl className="mt-3 text-sm grid grid-cols-2 gap-y-1">
                <dt className="text-slate-500">Daily rate</dt><dd>${Number(c.daily_rate).toFixed(2)}</dd>
                <dt className="text-slate-500">Deposit</dt><dd>${Number(c.deposit).toFixed(2)}</dd>
              </dl>
              <div className="mt-2 text-xs text-slate-500">
                Service areas: {(c.service_areas ?? []).map((s: any) => s.area).join(", ") || "—"}
              </div>
              {c.notes && <p className="mt-2 text-sm text-slate-600">{c.notes}</p>}

              <div className="mt-auto pt-3">
                <FlagButton carId={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
