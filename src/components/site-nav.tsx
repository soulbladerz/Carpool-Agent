"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  home: <path d="M3 9.8 12 3l9 6.8M5 10v10h14V10" />,
  market: (
    <>
      <path d="M5 11l1.6-4.5h10.8L19 11M3.5 11h17v6h-17z" />
      <circle cx="7.5" cy="17.5" r="1.4" />
      <circle cx="16.5" cy="17.5" r="1.4" />
    </>
  ),
  requests: <path d="M4 13h4l1.2 2h5.6L16 13h4M5 13 6.8 5h10.4L19 13v6H5z" />,
  bookings: <path d="M4.5 5.5h15v15h-15zM8 3v4M16 3v4M4.5 10h15M9.5 15l2 2 3.5-4" />,
  admin: <path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z" />
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {ICONS[name]}
    </svg>
  );
}

export default function SiteNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      {/* Desktop: inline pills in the top bar */}
      <nav className="hidden md:flex items-center gap-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-medium transition " +
              (active(it.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-900/5")
            }
          >
            {it.label}
          </Link>
        ))}
      </nav>

      {/* Mobile: fixed bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-lg">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium " +
                (active(it.href) ? "text-brand-700" : "text-slate-500")
              }
            >
              <Icon name={it.icon} />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
