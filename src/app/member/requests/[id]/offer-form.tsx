"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OfferableCar = {
  id: string;
  make: string;
  model: string;
  car_type: string;
  daily_rate: number;
  deposit: number;
};

export default function OfferForm({ requestId, cars }: { requestId: string; cars: OfferableCar[] }) {
  const router = useRouter();
  const [carId, setCarId] = useState<string>(cars[0]?.id ?? "");
  const initial = cars[0];
  const [rate, setRate] = useState<string>(initial ? String(initial.daily_rate) : "");
  const [deposit, setDeposit] = useState<string>(initial ? String(initial.deposit) : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      setLoading(false);
      return;
    }
    const { error: insertError } = await supabase.from("offers").insert({
      request_id: requestId,
      car_id: carId,
      offerer_id: user.id,
      daily_rate: Number(rate),
      deposit: Number(deposit),
      notes: notes.trim() || null
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <div>
        <label className="block font-medium mb-1">Car</label>
        <select
          value={carId}
          onChange={(e) => {
            const next = cars.find((c) => c.id === e.target.value);
            setCarId(e.target.value);
            if (next) {
              setRate(String(next.daily_rate));
              setDeposit(String(next.deposit));
            }
          }}
          className="w-full rounded border border-slate-300 px-3 py-2"
        >
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.make} {c.model} ({c.car_type})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium mb-1">Daily rate</label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Deposit</label>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="block font-medium mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <button
        disabled={loading}
        className="rounded bg-brand text-white px-4 py-2 disabled:opacity-60 hover:bg-brand-dark"
      >
        {loading ? "Submitting…" : "Submit offer"}
      </button>
    </form>
  );
}
