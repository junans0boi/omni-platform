import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  mapSupabaseProfile,
  requireSupabasePublicEnv,
  SUPABASE_PROFILE_SELECT,
  type SafeProfile,
  type SupabaseProfileRow,
} from "@/lib/auth-backend";

export async function createSupabaseAuthClient() {
  const cookieStore = await cookies();
  const { url, key } = requireSupabasePublicEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function getSupabaseSessionProfile(): Promise<SafeProfile | null> {
  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const result = await supabase
    .from("profiles")
    .select(SUPABASE_PROFILE_SELECT)
    .eq("auth_user_id", data.user.id)
    .eq("account_status", "ACTIVE")
    .maybeSingle();
  if (result.error || !result.data) return null;

  return mapSupabaseProfile(result.data as SupabaseProfileRow);
}

export async function updateSupabaseSessionProfile(input: {
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<SafeProfile | null> {
  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const update: Record<string, string | null> = {};
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.avatarUrl !== undefined) update.avatar_url = input.avatarUrl;

  const result = await supabase
    .from("profiles")
    .update(update)
    .eq("auth_user_id", data.user.id)
    .eq("account_status", "ACTIVE")
    .select(SUPABASE_PROFILE_SELECT)
    .single();
  if (result.error || !result.data) throw result.error ?? new Error("Profile update failed");

  return mapSupabaseProfile(result.data as SupabaseProfileRow);
}
