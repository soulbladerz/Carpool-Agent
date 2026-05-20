import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";
import VerifyButton from "./verify-button";

export default async function AdminPage() {
  const { supabase } = await requireRole("admin");

  const [members, cars, bookings] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, phone, role, is_verified, created_at")
      .eq("role", "member")
      .order("is_verified", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("cars")
      .select("id, make, model, daily_rate, status, owner:profiles!cars_owner_id_fkey(email, is_verified)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("bookings")
      .select(
        "id, status, start_at, end_at, daily_rate, " +
        "car:cars(make, model), " +
        "owner:profiles!bookings_owner_id_fkey(email), " +
        "booker:profiles!bookings_booker_id_fkey(email)"
      )
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Members</h1>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(members.data ?? []).map((m) => (
                <tr key={m.id} className="border-t border-slate-200">
                  <td className="p-3">{m.full_name || "—"}</td>
                  <td className="p-3">{m.email}</td>
                  <td className="p-3">{m.phone || "—"}</td>
                  <td className="p-3">
                    {m.is_verified ? (
                      <span className="text-emerald-700 text-xs">verified</span>
                    ) : (
                      <span className="text-amber-700 text-xs">pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <VerifyButton profileId={m.id} verified={m.is_verified} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Recent cars</h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Car</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(cars.data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t border-slate-200">
                  <td className="p-3">{c.make} {c.model}</td>
                  <td className="p-3">{c.owner?.email}</td>
                  <td className="p-3">{formatMYR(c.daily_rate)}</td>
                  <td className="p-3">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Recent bookings</h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Car</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Booker</th>
                <th className="p-3">Window</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(bookings.data ?? []).map((b: any) => (
                <tr key={b.id} className="border-t border-slate-200">
                  <td className="p-3">{b.car?.make} {b.car?.model}</td>
                  <td className="p-3">{b.owner?.email}</td>
                  <td className="p-3">{b.booker?.email}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {new Date(b.start_at).toLocaleString()}<br />
                    {new Date(b.end_at).toLocaleString()}
                  </td>
                  <td className="p-3">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
