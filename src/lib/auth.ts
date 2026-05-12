import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_verified, phone")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return { supabase, user, profile };
}

export async function requireRole(role: Role | Role[]) {
  const ctx = await requireUser();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(ctx.profile.role as Role)) redirect("/");
  return ctx;
}
