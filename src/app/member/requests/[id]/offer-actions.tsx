"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emitClientEvent } from "@/lib/webhooks/client";

export default function OfferActions({
  offerId,
  status,
  isRequester,
  isOfferer
}: {
  offerId: string;
  status: string;
  isRequester: boolean;
  isOfferer: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(fn: "accept_offer" | "reject_offer" | "withdraw_offer") {
    setLoading(fn);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(fn, { p_offer_id: offerId });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    // accept_offer returns the new booking id; reject/withdraw return void.
    if (fn === "accept_offer" && data) {
      await emitClientEvent("offer.accepted", { offer_id: offerId, booking_id: data });
      await emitClientEvent("booking.created", { booking_id: data, offer_id: offerId });
      router.push(`/member/bookings/${data}`);
      return;
    }
    if (fn === "reject_offer") {
      await emitClientEvent("offer.rejected", { offer_id: offerId });
    }
    router.refresh();
  }

  if (status !== "pending") return error ? <p className="text-red-600 text-xs">{error}</p> : null;

  return (
    <div className="flex gap-2 pt-2">
      {isRequester && (
        <>
          <button
            onClick={() => call("accept_offer")}
            disabled={loading !== null}
            className="text-xs rounded bg-brand text-white px-3 py-1 disabled:opacity-60"
          >
            {loading === "accept_offer" ? "…" : "Accept"}
          </button>
          <button
            onClick={() => call("reject_offer")}
            disabled={loading !== null}
            className="text-xs rounded border border-slate-300 px-3 py-1 disabled:opacity-60"
          >
            {loading === "reject_offer" ? "…" : "Reject"}
          </button>
        </>
      )}
      {isOfferer && (
        <button
          onClick={() => call("withdraw_offer")}
          disabled={loading !== null}
          className="text-xs rounded border border-slate-300 px-3 py-1 disabled:opacity-60"
        >
          {loading === "withdraw_offer" ? "…" : "Withdraw"}
        </button>
      )}
      {error && <p className="text-red-600 text-xs ml-2">{error}</p>}
    </div>
  );
}
