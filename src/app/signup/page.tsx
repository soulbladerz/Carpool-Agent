"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const search = useSearchParams();
  const router = useRouter();
  const initialRole = (search.get("role") === "owner" ? "owner" : "agent") as "owner" | "agent";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "agent">(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(role === "owner" ? "/owner" : "/agent");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <h1 className="text-2xl font-semibold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Full name" value={fullName} onChange={setFullName} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
        <div>
          <label className="block text-sm font-medium mb-1">I am a</label>
          <div className="flex gap-3">
            {(["owner", "agent"] as const).map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={role === r} onChange={() => setRole(r)} /> {r}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-brand text-white py-2 disabled:opacity-60 hover:bg-brand-dark"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        Already have an account? <Link href="/login" className="text-brand hover:underline">Log in</Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  minLength
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  );
}
