import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import SiteNav, { type NavItem } from "@/components/site-nav";
import { SpeedInsights } from "@vercel/speed-insights/next";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

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
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? null;
  }
  const isMember = role === "member" || role === "admin";

  const navItems: NavItem[] = isMember
    ? [
        { href: "/member", label: "Home", icon: "home" },
        { href: "/member/marketplace", label: "Market", icon: "market" },
        { href: "/member/requests", label: "Requests", icon: "requests" },
        { href: "/member/bookings", label: "Bookings", icon: "bookings" },
        ...(role === "admin" ? [{ href: "/admin", label: "Admin", icon: "admin" as const }] : [])
      ]
    : [];

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-paper/80 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href={isMember ? "/member" : "/"} className="flex items-center gap-2 shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 11l1.6-4.5h10.8L19 11M3.5 11h17v6h-17z" />
                  <circle cx="7.5" cy="17.5" r="1.4" />
                  <circle cx="16.5" cy="17.5" r="1.4" />
                </svg>
              </span>
              <span className="font-display font-bold text-lg tracking-tight">Carpool</span>
            </Link>

            {isMember && <SiteNav items={navItems} />}

            <div className="flex items-center gap-2 text-sm shrink-0">
              {user ? (
                <SignOutButton />
              ) : (
                <>
                  <Link href="/login" className="btn-ghost">Log in</Link>
                  <Link href="/signup" className="btn-primary">Sign up</Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl w-full px-4 py-8 pb-24 md:pb-10 flex-1">{children}</main>

        <footer className="hidden md:block text-xs text-slate-400 text-center py-5">
          Carpool Agent — source cars from the network when yours are full.
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}
