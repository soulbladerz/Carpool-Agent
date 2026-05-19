import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import OfferActions from "./offer-actions";
import OfferForm from "./offer-form";
import CancelRequest from "./cancel-request";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data: req } = await supabase
    .from("requests")
    .select("*, requester:profiles!requests_requester_id_fkey(full_name)")
    .eq("id", id)
    .single();
  if (!req) notFound();

  const isRequester = req.requester_id === profile.id;

  let customer = null;
  if (isRequester) {
    const { data } = await supabase
      .from("request_private")
      .select("customer_name, customer_phone, customer_notes")
      .eq("request_id", id)
      .single();
    customer = data;
  }

  const offersRes = await supabase
    .from("offers")
    .select(
      "id, daily_rate, deposit, notes, status, expires_at, created_at, car_id, offerer_id, " +
      "car:cars(make, model, year, car_type), " +
      "offerer:profiles!offers_offerer_id_fkey(full_name, phone)"
    )
    .eq("request_id", id)
    .order("created_at", { ascending: false });
  const offers = (offersRes.data ?? []) as any[];

  const carsRes = !isRequester
    ? await supabase
        .from("cars")
        .select("id, make, model, car_type, daily_rate, deposit, status")
        .eq("owner_id", profile.id)
        .eq("status", "available")
    : { data: null };
  const myCars = (carsRes.data ?? []) as any[];

  // For a direct request (car_id set), only the specifically requested car
  // may be offered. Honors the requester's contract: "I want this car."
  const myCarsForOffer = req.car_id ? myCars.filter((c) => c.id === req.car_id) : myCars;

  const alreadyOffered = new Set(offers.filter((o) => o.offerer_id === profile.id).map((o) => o.car_id));
  const offerableCars = myCarsForOffer.filter((c) => !alreadyOffered.has(c.id));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Request</h1>
        <div className="flex items-center gap-2">
          <span
            className={
              "text-xs rounded-full px-2 py-1 " +
              (req.car_id ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700")
            }
          >
            {req.car_id ? "Direct" : "Open"}
          </span>
          <span className="text-xs rounded-full px-2 py-1 bg-slate-200 text-slate-700">{req.status}</span>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-2 text-sm">
        <h2 className="font-semibold">Trip details</h2>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-slate-500">Pickup area</dt><dd>{req.pickup_area}</dd>
          <dt className="text-slate-500">Car type</dt><dd>{req.car_type ?? "Any"}</dd>
          <dt className="text-slate-500">Start</dt><dd>{new Date(req.start_at).toLocaleString()}</dd>
          <dt className="text-slate-500">End</dt><dd>{new Date(req.end_at).toLocaleString()}</dd>
          <dt className="text-slate-500">Passengers</dt><dd>{req.passenger_count}</dd>
          <dt className="text-slate-500">Max rate</dt>
          <dd>{req.max_daily_rate != null ? `$${Number(req.max_daily_rate).toFixed(2)}/day` : "—"}</dd>
          <dt className="text-slate-500">Posted by</dt><dd>{req.requester?.full_name ?? "—"}</dd>
        </dl>
        {req.notes && <p className="pt-2 border-t border-slate-200 text-slate-600">{req.notes}</p>}
      </section>

      {customer && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-2 text-sm">
          <h2 className="font-semibold text-amber-900">Customer (private)</h2>
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-slate-600">Name</dt><dd>{customer.customer_name}</dd>
            <dt className="text-slate-600">Phone</dt><dd>{customer.customer_phone}</dd>
            {customer.customer_notes && (
              <>
                <dt className="text-slate-600">Notes</dt>
                <dd className="whitespace-pre-wrap">{customer.customer_notes}</dd>
              </>
            )}
          </dl>
          <p className="text-xs text-amber-800 pt-2">
            Only you (and admin) can see this. Car owners never see customer name or phone.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Offers ({offers.length})</h2>
        {!offers.length ? (
          <p className="text-sm text-slate-500">No offers yet.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((o: any) => (
              <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-4 text-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">
                      {o.car?.make} {o.car?.model} &middot; {o.car?.car_type}
                    </div>
                    <div className="text-xs text-slate-500">
                      Offerer: {o.offerer?.full_name ?? "—"}
                    </div>
                  </div>
                  <span className="text-xs rounded-full px-2 py-1 bg-slate-200 text-slate-700">{o.status}</span>
                </div>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-slate-500">Daily rate</dt><dd>${Number(o.daily_rate).toFixed(2)}</dd>
                  <dt className="text-slate-500">Deposit</dt><dd>${Number(o.deposit).toFixed(2)}</dd>
                </dl>
                {o.notes && <p className="text-slate-600">{o.notes}</p>}
                <OfferActions
                  offerId={o.id}
                  status={o.status}
                  isRequester={isRequester}
                  isOfferer={o.offerer_id === profile.id}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {!isRequester && req.status === "open" && offerableCars.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Submit an offer</h2>
          <OfferForm requestId={req.id} cars={offerableCars} />
        </section>
      )}

      {isRequester && req.status === "open" && <CancelRequest requestId={req.id} />}
    </div>
  );
}
