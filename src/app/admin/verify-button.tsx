"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyButton({ profileId, verified }: { profileId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch(`/api/admin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, verified: !verified })
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs rounded px-3 py-1 ${
        verified ? "bg-slate-200 text-slate-700" : "bg-brand text-white"
      }`}
    >
      {loading ? "…" : verified ? "Unverify" : "Verify"}
    </button>
  );
}
