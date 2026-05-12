import { requireRole } from "@/lib/auth";
import VerifyButton from "./verify-button";

export default async function AdminPage() {
  const { supabase } = await requireRole("admin");

  const [owners, cars] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, phone, role, is_verified, created_at")
      .eq("role", "owner")
      .order("created_at", { ascending: false }),
    supabase
      .from("cars")
      .select("id, make, model, daily_rate, status, owner:profiles!cars_owner_id_fkey(email, is_verified)")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Owners</h1>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(owners.data ?? []).map((o) => (
                <tr key={o.id} className="border-t border-slate-200">
                  <td className="p-3">{o.full_name || "—"}</td>
                  <td className="p-3">{o.email}</td>
                  <td className="p-3">
                    {o.is_verified ? (
                      <span className="text-emerald-700 text-xs">verified</span>
                    ) : (
                      <span className="text-amber-700 text-xs">pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <VerifyButton profileId={o.id} verified={o.is_verified} />
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
                  <td className="p-3">${Number(c.daily_rate).toFixed(2)}</td>
                  <td className="p-3">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
