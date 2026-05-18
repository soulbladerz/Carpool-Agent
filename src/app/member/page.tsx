import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function MemberDashboard() {
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const [carsRes, openReqRes, bookingsRes] = await Promise.all([
    supabase.from("cars").select("id, make, model, status").eq("owner_id", profile.id),
    supabase
      .from("requests")
      .select("id, pickup_area, start_at, end_at, status")
      .eq("requester_id", profile.id)
      .in("status", ["open", "matched"])
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, status, start_at, end_at, owner_id, booker_id")
      .or(`booker_id.eq.${profile.id},owner_id.eq.${profile.id}`)
      .in("status", ["pending_owner_confirmation", "confirmed", "in_progress"])
      .order("created_at", { ascending: false })
  ]);

  const myCars = carsRes.data ?? [];
  const myRequests = openReqRes.data ?? [];
  const myBookings = bookingsRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome{profile.full_name ? `, ${profile.full_name}` : ""}</h1>
        {!profile.is_verified && (
          <p className="text-amber-700 text-sm mt-1">
            Your account is pending admin verification. Your cars are hidden from other members until approved.
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Tile
          href="/member/cars"
          title="My cars"
          count={myCars.length}
          cta="Manage cars"
        />
        <Tile
          href="/member/requests"
          title="My requests"
          count={myRequests.length}
          cta="View requests"
        />
        <Tile
          href="/member/bookings"
          title="Active bookings"
          count={myBookings.length}
          cta="View bookings"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold mb-2">Get started</h2>
        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
          <li><Link href="/member/cars/new" className="text-brand hover:underline">Add a car</Link> so other members can request it.</li>
          <li><Link href="/member/requests/new" className="text-brand hover:underline">Post a customer request</Link> to source from the network.</li>
          <li><Link href="/member/marketplace" className="text-brand hover:underline">Browse the marketplace</Link> for available cars.</li>
          <li><Link href="/member/marketplace/requests" className="text-brand hover:underline">Browse open requests</Link> from other members.</li>
        </ul>
      </div>
    </div>
  );
}

function Tile({ href, title, count, cta }: { href: string; title: string; count: number; cta: string }) {
  return (
    <Link
      href={href}
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-brand"
    >
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-3xl font-semibold mt-2">{count}</div>
      <div className="text-xs text-brand mt-3">{cta} &rarr;</div>
    </Link>
  );
}
