"use client";

import { useState } from "react";

export type ActionOption = { key: string; label: string; tone: "pos" | "neg" };

type Status = "idle" | "loading" | "done" | "error";

export default function ActButtons({ token, actions }: { token: string; actions: ActionOption[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

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
        {actions.map((a) => (
          <button
            key={a.key}
            disabled={status === "loading"}
            onClick={() => act(a.key)}
            className={
              "flex-1 rounded-md text-white py-2.5 text-sm font-medium disabled:opacity-50 " +
              (a.tone === "pos" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700")
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      {status === "loading" && <p className="text-xs text-slate-500">Working…</p>}
    </div>
  );
}
