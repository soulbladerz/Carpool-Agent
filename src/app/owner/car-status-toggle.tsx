"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CarStatus } from "@/lib/types";

const NEXT: Record<CarStatus, CarStatus> = {
  available: "inactive",
  inactive: "available",
  flagged: "available",
  rented: "available"
};

const LABEL: Record<CarStatus, string> = {
  available: "Available",
  flagged: "Flagged",
  rented: "Rented",
  inactive: "Inactive"
};

const COLOR: Record<CarStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  flagged: "bg-amber-100 text-amber-800",
  rented: "bg-sky-100 text-sky-800",
  inactive: "bg-slate-200 text-slate-700"
};

export default function CarStatusToggle({ carId, status }: { carId: string; status: CarStatus }) {
  const [current, setCurrent] = useState<CarStatus>(status);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = NEXT[current];
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("cars")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", carId);
    if (!error) {
      setCurrent(next);
      startTransition(() => router.refresh());
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`text-xs rounded-full px-2 py-1 ${COLOR[current]}`}
      title="Click to toggle"
    >
      {LABEL[current]}
    </button>
  );
}
