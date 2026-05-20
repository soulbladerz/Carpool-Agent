import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";
import CarStatusToggle from "./car-status-toggle";

export default async function MyCarsPage() {
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data: cars } = await supabase
    .from("cars")
    .select("id, make, model, year, car_type, daily_rate, deposit, status, service_areas(area)")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My cars</h1>
          {!profile.is_verified && (
            <p className="text-amber-700 text-sm mt-1">
              Your account is pending admin verification. Listings are hidden from other members until approved.
            </p>
          )}
        </div>
        <Link href="/member/cars/new" className="rounded bg-brand text-white px-4 py-2 hover:bg-brand-dark">
          + Add car
        </Link>
      </div>

      {!cars?.length ? (
        <p className="text-slate-500">No cars yet. Add your first car to get started.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {cars.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {c.make} {c.model} {c.year ? `(${c.year})` : ""}
                  </h3>
                  <p className="text-sm text-slate-500">{c.car_type}</p>
                </div>
                <CarStatusToggle carId={c.id} status={c.status} />
              </div>
              <dl className="mt-3 text-sm grid grid-cols-2 gap-y-1">
                <dt className="text-slate-500">Daily rate</dt><dd>{formatMYR(c.daily_rate)}</dd>
                <dt className="text-slate-500">Deposit</dt><dd>{formatMYR(c.deposit)}</dd>
              </dl>
              <div className="mt-3 text-sm">
                <span className="text-slate-500">Service areas: </span>
                {c.service_areas?.length
                  ? c.service_areas.map((a: { area: string }) => a.area).join(", ")
                  : <span className="italic text-slate-400">none</span>}
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <Link href={`/member/cars/${c.id}`} className="text-brand hover:underline">Edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
