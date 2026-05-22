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
    router.push(profile?.role === "admin" ? "/admin" : "/member/marketplace");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto card p-6 sm:p-7">
      <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
      <p className="text-sm text-slate-500 mb-5">Log in to your Carpool account.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        No account? <Link href="/signup" className="text-brand hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
