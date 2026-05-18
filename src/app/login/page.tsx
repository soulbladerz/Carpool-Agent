"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setError(error?.message ?? "Login failed");
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    router.push(profile?.role === "admin" ? "/admin" : "/member");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-brand text-white py-2 disabled:opacity-60 hover:bg-brand-dark"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        No account? <Link href="/signup" className="text-brand hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
