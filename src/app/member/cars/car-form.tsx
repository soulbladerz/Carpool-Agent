"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FormState = {
  id?: string;
  make: string;
  model: string;
  year: number | "";
  car_type: string;
  plate: string;
  daily_rate: number | "";
  deposit: number | "";
  notes: string;
  areas: string;
};

const CAR_TYPES = ["Sedan", "SUV", "Hatchback", "Van", "Pickup", "Luxury", "Other"];

export default function CarForm({ initial }: { initial?: FormState }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initial ?? {
      make: "",
      model: "",
      year: "",
      car_type: "Sedan",
      plate: "",
      daily_rate: "",
      deposit: "",
      notes: "",
      areas: ""
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

    const payload = {
      owner_id: user.id,
      make: form.make.trim(),
      model: form.model.trim(),
      year: form.year === "" ? null : Number(form.year),
      car_type: form.car_type,
      plate: form.plate.trim() || null,
      daily_rate: Number(form.daily_rate),
      deposit: Number(form.deposit),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString()
    };

    let carId = form.id;
    if (carId) {
      const { error } = await supabase.from("cars").update(payload).eq("id", carId);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("cars")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setError(error?.message ?? "Failed to save");
        setLoading(false);
        return;
      }
      carId = data.id;
    }

    // Replace service areas (simple: delete + insert).
    const areas = form.areas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    await supabase.from("service_areas").delete().eq("car_id", carId);
    if (areas.length) {
      await supabase
        .from("service_areas")
        .insert(areas.map((area) => ({ car_id: carId, area })));
    }

    router.push("/member/cars");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Make" value={form.make} onChange={(v) => update("make", v)} required />
        <Field label="Model" value={form.model} onChange={(v) => update("model", v)} required />
        <Field
          label="Year"
          type="number"
          value={String(form.year)}
          onChange={(v) => update("year", v === "" ? "" : Number(v))}
        />
        <div>
          <label className="block text-sm font-medium mb-1">Car type</label>
          <select
            value={form.car_type}
            onChange={(e) => update("car_type", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {CAR_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <Field label="Plate (optional)" value={form.plate} onChange={(v) => update("plate", v)} />
        <Field
          label="Daily rate"
          type="number"
          value={String(form.daily_rate)}
          onChange={(v) => update("daily_rate", v === "" ? "" : Number(v))}
          required
        />
        <Field
          label="Deposit"
          type="number"
          value={String(form.deposit)}
          onChange={(v) => update("deposit", v === "" ? "" : Number(v))}
          required
        />
      </div>
      <Field
        label="Service areas (comma-separated, e.g. KL, PJ, Subang)"
        value={form.areas}
        onChange={(v) => update("areas", v)}
      />
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={loading}
        className="w-full rounded bg-brand text-white py-2 disabled:opacity-60 hover:bg-brand-dark"
      >
        {loading ? "Saving…" : form.id ? "Save changes" : "Create car"}
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
      <label className="block text-sm font-medium mb-1">{label}</label>
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
