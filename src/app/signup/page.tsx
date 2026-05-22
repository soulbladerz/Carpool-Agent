"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: "member" } }
    });
    if (error || !data.user) {
      setLoading(false);
      setError(error?.message ?? "Sign up failed");
      return;
    }
    if (phone.trim()) {
      await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", data.user.id);
    }
    setLoading(false);
    router.push("/member");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto card p-6 sm:p-7">
      <h1 className="text-2xl font-bold mb-2">Create your account</h1>
      <p className="text-sm text-slate-600 mb-4">
        Every member can list cars and post customer requests. Admins verify new members.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Full name" value={fullName} onChange={setFullName} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Phone (for other members to reach you)" value={phone} onChange={setPhone} />
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="btn-primary w-full py-2.5">
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
      <label className="label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="input"
      />
    </div>
  );
}
