import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import BookingActions from "./booking-actions";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireRole(["member", "admin"]);

  const { data } = await supabase
    .from("bookings")
    .select(
      "*, car:cars(make, model, year, car_type, plate), " +
      "owner:profiles!bookings_owner_id_fkey(full_name, phone), " +
      "booker:profiles!bookings_booker_id_fkey(full_name, phone)"
    )
    .eq("id", id)
    .single();
  const booking = data as any;
  if (!booking) notFound();

  const isOwner = booking.owner_id === profile.id;
  const isBooker = booking.booker_id === profile.id;

  let customer = null;
  if (isBooker) {
    const { data } = await supabase
      .from("request_private")
      .select("customer_name, customer_phone, customer_notes")
      .eq("request_id", booking.request_id)
      .single();
    customer = data;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Booking</h1>
        <span className="text-xs rounded-full px-2 py-1 bg-slate-200 text-slate-700">{booking.status}</span>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-2 text-sm">
        <h2 className="font-semibold">Car &amp; trip</h2>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-slate-500">Car</dt>
          <dd>{booking.car?.make} {booking.car?.model} {booking.car?.year ? `(${booking.car.year})` : ""}</dd>
          <dt className="text-slate-500">Type</dt><dd>{booking.car?.car_type}</dd>
          {isOwner && booking.car?.plate && (
            <>
              <dt className="text-slate-500">Plate</dt><dd>{booking.car.plate}</dd>
            </>
          )}
          <dt className="text-slate-500">Pickup area</dt><dd>{booking.pickup_area}</dd>
          <dt className="text-slate-500">Passengers</dt><dd>{booking.passenger_count}</dd>
          <dt className="text-slate-500">Start</dt><dd>{new Date(booking.start_at).toLocaleString()}</dd>
          <dt className="text-slate-500">End</dt><dd>{new Date(booking.end_at).toLocaleString()}</dd>
          <dt className="text-slate-500">Daily rate</dt><dd>${Number(booking.daily_rate).toFixed(2)}</dd>
          <dt className="text-slate-500">Deposit</dt><dd>${Number(booking.deposit).toFixed(2)}</dd>
        </dl>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-2 text-sm">
        <h2 className="font-semibold">Parties</h2>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-slate-500">Car owner</dt>
          <dd>{booking.owner?.full_name ?? "—"}{booking.owner?.phone ? ` · ${booking.owner.phone}` : ""}</dd>
          <dt className="text-slate-500">Booker</dt>
          <dd>{booking.booker?.full_name ?? "—"}{booking.booker?.phone ? ` · ${booking.booker.phone}` : ""}</dd>
        </dl>
        {isOwner && (
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            Customer details are visible only to the booker. Coordinate pickup through the booker.
          </p>
        )}
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
        </section>
      )}

      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        isOwner={isOwner}
        isBooker={isBooker}
      />
    </div>
  );
}
