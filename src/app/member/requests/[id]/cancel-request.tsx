"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function CancelRequest({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel this request? Pending offers will be rejected.")) return;
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("cancel_request", { p_request_id: requestId });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-sm">
      <button
        onClick={cancel}
        disabled={loading}
        className="text-xs rounded border border-red-300 text-red-700 px-3 py-1 disabled:opacity-60 hover:bg-red-50"
      >
        {loading ? "Cancelling…" : "Cancel request"}
      </button>
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  );
}
