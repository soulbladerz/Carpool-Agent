import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";

type SearchParams = Promise<{ area?: string; type?: string }>;

export default async function OpenRequestsMarketplace({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireRole(["member", "admin"]);
  const { area, type } = await searchParams;

  let query = supabase
    .from("requests")
    .select(
      "id, requester_id, car_type, pickup_area, start_at, end_at, passenger_count, max_daily_rate, notes, expires_at, created_at, " +
      "requester:profiles!requests_requester_id_fkey(full_name)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("car_type", type);
  if (area) query = query.ilike("pickup_area", `%${area}%`);

  const { data: rows, error } = await query;
  const requests = (rows ?? []).filter((r: any) => r.requester_id !== profile.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Open requests</h1>
        <Link href="/member/marketplace" className="text-sm text-brand hover:underline">
          &larr; Browse cars instead
        </Link>
      </div>

      <form className="grid sm:grid-cols-3 gap-2 bg-white p-4 rounded-lg border border-slate-200">
        <input
          name="area"
          placeholder="Pickup area"
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
        <button className="rounded bg-brand text-white text-sm hover:bg-brand-dark">Filter</button>
      </form>

      {error && <p className="text-red-600 text-sm">{error.message}</p>}

      {requests.length === 0 ? (
        <p className="text-slate-500">No open requests right now.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {requests.map((r: any) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{r.car_type ?? "Any type"} &middot; {r.pickup_area}</h3>
                  <p className="text-xs text-slate-500">
                    From {r.requester?.full_name ?? "member"} &middot; {timeRange(r.start_at, r.end_at)}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{r.passenger_count} pax</span>
              </div>
              {r.max_daily_rate != null && (
                <p className="text-sm text-slate-600 mt-2">
                  Max rate: {formatMYR(r.max_daily_rate)}/day
                </p>
              )}
              {r.notes && <p className="text-sm text-slate-600 mt-2">{r.notes}</p>}
              <div className="mt-3">
                <Link
                  href={`/member/requests/${r.id}`}
                  className="inline-block rounded bg-brand text-white text-sm px-3 py-2 hover:bg-brand-dark"
                >
                  Submit offer
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleString()} → ${e.toLocaleString()}`;
}
