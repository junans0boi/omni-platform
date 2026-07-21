export type AuthBackend = "legacy" | "supabase";

type Environment = Record<string, string | undefined>;

export type SafeProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  availability: "AVAILABLE" | "IDLE" | "DND";
  customStatus: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SupabaseProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  availability?: "AVAILABLE" | "IDLE" | "DND";
  custom_status?: string | null;
  created_at: string;
  updated_at: string;
  account_status: string;
  auth_user_id: string | null;
};

export const SUPABASE_PROFILE_SELECT =
  "id,username,display_name,avatar_url,availability,custom_status,created_at,updated_at,account_status,auth_user_id";

export function getAuthBackend(env: Environment = process.env): AuthBackend {
  const configured = env.OMNI_PLATFORM_BACKEND?.trim().toLowerCase();
  if (!configured || configured === "legacy") return "legacy";
  if (configured === "supabase") return "supabase";
  throw new Error("OMNI_PLATFORM_BACKEND must be either legacy or supabase");
}

export function requireSupabasePublicEnv(env: Environment = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase public environment is not configured");
  }
  return { url, key };
}

export function mapSupabaseProfile(row: SupabaseProfileRow): SafeProfile {
  if (row.account_status !== "ACTIVE" || !row.auth_user_id) {
    throw new Error("Profile is not active");
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    availability: row.availability ?? "AVAILABLE",
    customStatus: row.custom_status ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
