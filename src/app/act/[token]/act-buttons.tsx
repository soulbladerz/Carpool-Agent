"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

export default function ActButtons({ token, kind }: { token: string; kind: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const positive = kind === "offer_decision" ? "accept" : "confirm";
  const negative = kind === "offer_decision" ? "reject" : "decline";
  const posLabel = kind === "offer_decision" ? "Accept" : "Confirm";
  const negLabel = kind === "offer_decision" ? "Reject" : "Decline";

  async function act(action: string) {
    setStatus("loading");
    try {
      const res = await fetch(`/api/act/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "done") {
    return <p className="text-sm font-medium text-emerald-700">✅ {message}</p>;
  }

  return (
    <div className="space-y-2">
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
      <div className="flex gap-2">
        <button
          disabled={status === "loading"}
          onClick={() => act(positive)}
          className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {posLabel}
        </button>
        <button
          disabled={status === "loading"}
          onClick={() => act(negative)}
          className="flex-1 rounded-md bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {negLabel}
        </button>
      </div>
      {status === "loading" && <p className="text-xs text-slate-500">Working…</p>}
    </div>
  );
}
