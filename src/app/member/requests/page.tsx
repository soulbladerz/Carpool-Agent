import Link from "next/link";
import { requireRole } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  matched: "Matched",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  expired: "Expired"
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  matched: "bg-sky-100 text-sky-800",
  fulfilled: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
  expired: "bg-slate-200 text-slate-700"
};

export default async function MyRequests() {
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data: mine } = await supabase
    .from("requests")
    .select("id, car_type, pickup_area, start_at, end_at, status, car_id, created_at, expires_at")
    .eq("requester_id", profile.id)
    .order("created_at", { ascending: false });

  // Direct requests for cars I own. RLS already restricts visibility, so a
  // simple query for non-null car_id where I'm not the requester suffices.
  const { data: incoming } = await supabase
    .from("requests")
    .select(
      "id, car_type, pickup_area, start_at, end_at, status, car_id, created_at, " +
      "car:cars!requests_car_id_fkey(make, model), " +
      "requester:profiles!requests_requester_id_fkey(full_name)"
    )
    .not("car_id", "is", null)
    .neq("requester_id", profile.id)
    .order("created_at", { ascending: false });

  const myList = mine ?? [];
  const incomingList = (incoming ?? []) as any[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <Link href="/member/requests/new" className="btn-primary">+ New request</Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Direct requests for your cars ({incomingList.length})</h2>
        {!incomingList.length ? (
          <p className="text-sm text-slate-500">
            Nothing here yet. When another member requests one of your specific cars, it will appear here.
          </p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Car</th>
                  <th className="p-3">From</th>
                  <th className="p-3">Pickup</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {incomingList.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="p-3">
                      {r.car?.make ?? "—"} {r.car?.model ?? ""}
                    </td>
                    <td className="p-3 text-slate-700">{r.requester?.full_name ?? "Member"}</td>
                    <td className="p-3">{r.pickup_area}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(r.start_at).toLocaleString()}<br />
                      {new Date(r.end_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/member/requests/${r.id}`} className="text-brand hover:underline">
                        View &amp; offer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My requests ({myList.length})</h2>
        {!myList.length ? (
          <p className="text-sm text-slate-500">No requests posted yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Pickup</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {myList.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="p-3">{r.pickup_area}</td>
                    <td className="p-3">{r.car_type ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={
                          "text-xs rounded-full px-2 py-0.5 " +
                          (r.car_id ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700")
                        }
                      >
                        {r.car_id ? "Direct" : "Open"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(r.start_at).toLocaleString()}<br />
                      {new Date(r.end_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/member/requests/${r.id}`} className="text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
