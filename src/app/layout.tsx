import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "Carpool Agent",
  description: "Member marketplace for car owners and rental agents."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  const isMember = role === "member" || role === "admin";

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="bg-brand text-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">Carpool Agent</Link>
            <nav className="flex items-center gap-4 text-sm">
              {isMember && (
                <>
                  <Link href="/member">Dashboard</Link>
                  <Link href="/member/marketplace">Marketplace</Link>
                  <Link href="/member/requests">Requests</Link>
                  <Link href="/member/bookings">Bookings</Link>
                </>
              )}
              {role === "admin" && <Link href="/admin">Admin</Link>}
              {user ? (
                <SignOutButton />
              ) : (
                <>
                  <Link href="/login">Login</Link>
                  <Link href="/signup" className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl w-full px-4 py-8 flex-1">{children}</main>
        <footer className="text-xs text-slate-500 text-center py-4">
          Carpool Agent — minimal-cost MVP
        </footer>
      </body>
    </html>
  );
}
