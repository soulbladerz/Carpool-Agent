"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function FlagButton({ carId }: { carId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function flag() {
    setLoading(true);
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg("Please log in");
      setLoading(false);
      return;
    }
    const { error: flagError } = await supabase.from("flags").insert({
      car_id: carId,
      agent_id: user.id
    });
    if (flagError) {
      setMsg(flagError.message);
      setLoading(false);
      return;
    }
    const { error: carError } = await supabase
      .from("cars")
      .update({ status: "flagged" })
      .eq("id", carId);
    setLoading(false);
    if (carError) {
      setMsg(carError.message);
      return;
    }
    setMsg("Held for 24 hours. Owner has been notified.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={flag}
        disabled={loading}
        className="w-full rounded bg-brand text-white text-sm py-2 disabled:opacity-60 hover:bg-brand-dark"
      >
        {loading ? "Flagging…" : "Flag / Hold (24h)"}
      </button>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
