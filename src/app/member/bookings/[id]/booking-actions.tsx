"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emitClientEvent, type WebhookEvent } from "@/lib/webhooks/client";

const EVENT_FOR_FN: Record<string, WebhookEvent> = {
  confirm_booking:  "booking.confirmed",
  start_booking:    "booking.started",
  complete_booking: "booking.completed",
  cancel_booking:   "booking.cancelled"
};

export default function BookingActions({
  bookingId,
  status,
  isOwner,
  isBooker
}: {
  bookingId: string;
  status: string;
  isOwner: boolean;
  isBooker: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    fn: "confirm_booking" | "start_booking" | "complete_booking" | "cancel_booking",
    extra?: Record<string, unknown>
  ) {
    setLoading(fn);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const args: Record<string, unknown> = { p_booking_id: bookingId, ...extra };
    const { error } = await supabase.rpc(fn, args);
    setLoading(null);
    if (error) {
      const friendly = error.message.includes("car_unavailable_in_window")
        ? "Your car was confirmed for a conflicting booking in the meantime. This one can't be confirmed."
        : error.message;
      setError(friendly);
      return;
    }
    await emitClientEvent(EVENT_FOR_FN[fn], {
      booking_id: bookingId,
      ...(extra ?? {})
    });
    router.refresh();
  }

  async function cancel() {
    const reason = prompt("Reason for cancellation (optional):") ?? null;
    await call("cancel_booking", { p_reason: reason });
  }

  const buttons: { label: string; run: () => void; danger?: boolean }[] = [];

  if (status === "pending_owner_confirmation" && isOwner) {
    buttons.push({ label: loading === "confirm_booking" ? "Confirming…" : "Confirm booking", run: () => call("confirm_booking") });
  }
  if (status === "confirmed" && (isOwner || isBooker)) {
    buttons.push({ label: loading === "start_booking" ? "Starting…" : "Mark in progress", run: () => call("start_booking") });
  }
  if (status === "in_progress" && (isOwner || isBooker)) {
    buttons.push({ label: loading === "complete_booking" ? "Completing…" : "Mark completed", run: () => call("complete_booking") });
  }
  if (["pending_owner_confirmation", "confirmed", "in_progress"].includes(status) && (isOwner || isBooker)) {
    buttons.push({ label: loading === "cancel_booking" ? "Cancelling…" : "Cancel", run: cancel, danger: true });
  }

  if (buttons.length === 0 && !error) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-sm">
      <h2 className="font-semibold">Actions</h2>
      <div className="flex gap-2 flex-wrap">
        {buttons.map((b) => (
          <button
            key={b.label}
            onClick={b.run}
            disabled={loading !== null}
            className={
              b.danger
                ? "rounded border border-red-300 text-red-700 px-3 py-2 hover:bg-red-50 disabled:opacity-60"
                : "rounded bg-brand text-white px-3 py-2 hover:bg-brand-dark disabled:opacity-60"
            }
          >
            {b.label}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </section>
  );
}
