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

  const { data: requests } = await supabase
    .from("requests")
    .select("id, car_type, pickup_area, start_at, end_at, status, created_at, expires_at")
    .eq("requester_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My requests</h1>
        <Link href="/member/requests/new" className="rounded bg-brand text-white px-4 py-2 hover:bg-brand-dark">
          + New request
        </Link>
      </div>

      {!requests?.length ? (
        <p className="text-slate-500">No requests yet.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Pickup</th>
                <th className="p-3">Type</th>
                <th className="p-3">Window</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="p-3">{r.pickup_area}</td>
                  <td className="p-3">{r.car_type ?? "—"}</td>
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
    </div>
  );
}
