"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CAR_TYPES = ["Sedan", "SUV", "Hatchback", "Van", "Pickup", "Luxury", "Other"];

export default function RequestForm({
  carId,
  defaultCarType,
  defaultArea
}: {
  carId: string | null;
  defaultCarType: string;
  defaultArea: string;
}) {
  const router = useRouter();
  const [carType, setCarType] = useState(defaultCarType || "Sedan");
  const [pickupArea, setPickupArea] = useState(defaultArea);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [passengers, setPassengers] = useState<number | "">("");
  const [maxRate, setMaxRate] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
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

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Please pick both a start and end date/time.");
      setLoading(false);
      return;
    }
    if (endDate <= startDate) {
      setError("End time must be after start time.");
      setLoading(false);
      return;
    }
    if (startDate < new Date()) {
      setError("Start time must be in the future.");
      setLoading(false);
      return;
    }

    const { data: requestId, error: rpcError } = await supabase.rpc("create_request", {
      p_car_id: carId,
      p_car_type: carType || null,
      p_pickup_area: pickupArea.trim(),
      p_start_at: new Date(startAt).toISOString(),
      p_end_at: new Date(endAt).toISOString(),
      p_passenger_count: Number(passengers),
      p_max_daily_rate: maxRate === "" ? null : Number(maxRate),
      p_notes: notes.trim() || null,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_customer_notes: customerNotes.trim() || null
    });
    if (rpcError || !requestId) {
      setError(rpcError?.message ?? "Failed to create request");
      setLoading(false);
      return;
    }

    router.push(`/member/requests/${requestId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">Trip details (visible to other members)</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Car type</label>
            <select
              value={carType}
              onChange={(e) => setCarType(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              {CAR_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Field label="Pickup area" value={pickupArea} onChange={setPickupArea} required />
          <Field
            label="Start (date &amp; time)"
            type="datetime-local"
            value={startAt}
            onChange={setStartAt}
            required
          />
          <Field
            label="End (date &amp; time)"
            type="datetime-local"
            value={endAt}
            onChange={setEndAt}
            required
          />
          <Field
            label="Passengers"
            type="number"
            value={String(passengers)}
            onChange={(v) => setPassengers(v === "" ? "" : Number(v))}
            required
          />
          <Field
            label="Max daily rate (optional)"
            type="number"
            value={String(maxRate)}
            onChange={(v) => setMaxRate(v === "" ? "" : Number(v))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes (visible to other members)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Do NOT include customer name or phone here."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3 mt-4 pt-4 border-t border-slate-200">
        <legend className="text-sm font-semibold text-slate-700 mb-2">
          Customer details (private — only you and the system can see this)
        </legend>
        <Field label="Customer name" value={customerName} onChange={setCustomerName} required />
        <Field label="Customer phone" value={customerPhone} onChange={setCustomerPhone} required />
        <div>
          <label className="block text-sm font-medium mb-1">Customer notes (private)</label>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={loading}
        className="w-full rounded bg-brand text-white py-2 disabled:opacity-60 hover:bg-brand-dark"
      >
        {loading ? "Posting…" : "Post request"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  );
}
