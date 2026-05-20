import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pending_owner_confirmation: "Awaiting owner",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled"
};

const STATUS_COLOR: Record<string, string> = {
  pending_owner_confirmation: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700"
};

export default async function BookingsPage() {
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, status, start_at, end_at, daily_rate, deposit, owner_id, booker_id, pickup_area, " +
      "car:cars(make, model, car_type)"
    )
    .or(`booker_id.eq.${profile.id},owner_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as any[];
  const asOwner = bookings.filter((b) => b.owner_id === profile.id);
  const asBooker = bookings.filter((b) => b.booker_id === profile.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Bookings</h1>

      <Section title="As car owner (incoming)" items={asOwner} />
      <Section title="As booker (your customers)" items={asBooker} />
    </div>
  );

  function Section({ title, items }: { title: string; items: any[] }) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {!items.length ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Car</th>
                  <th className="p-3">Pickup</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b: any) => (
                  <tr key={b.id} className="border-t border-slate-200">
                    <td className="p-3">
                      {b.car?.make} {b.car?.model}
                      <div className="text-xs text-slate-500">{b.car?.car_type}</div>
                    </td>
                    <td className="p-3">{b.pickup_area}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(b.start_at).toLocaleString()}<br />
                      {new Date(b.end_at).toLocaleString()}
                    </td>
                    <td className="p-3">{formatMYR(b.daily_rate)}</td>
                    <td className="p-3">
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/member/bookings/${b.id}`} className="text-brand hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }
}
