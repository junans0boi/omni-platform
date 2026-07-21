import { describe, expect, it } from "vitest";
import {
  getAuthBackend,
  mapSupabaseProfile,
  requireSupabasePublicEnv,
} from "../../src/lib/auth-backend";

describe("authentication data-plane boundary", () => {
  it("keeps legacy sessions until the explicit Supabase cutover switch", () => {
    expect(getAuthBackend({})).toBe("legacy");
    expect(getAuthBackend({ OMNI_PLATFORM_BACKEND: "supabase" })).toBe("supabase");
    expect(() => getAuthBackend({ OMNI_PLATFORM_BACKEND: "unexpected" })).toThrow(
      "OMNI_PLATFORM_BACKEND",
    );
  });

  it("requires only the public URL and publishable key at the user-session boundary", () => {
    expect(
      requireSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
      }),
    ).toEqual({
      url: "https://project.example.test",
      key: "public-test-key",
    });
    expect(() => requireSupabasePublicEnv({})).toThrow(
      "Supabase public environment",
    );
  });

  it("maps only the safe active Profile fields exposed by the app contract", () => {
    expect(
      mapSupabaseProfile({
        id: "profile-id",
        username: "alice",
        display_name: "Alice",
        avatar_url: null,
        created_at: "2026-07-21T00:00:00.000Z",
        updated_at: "2026-07-21T01:00:00.000Z",
        account_status: "ACTIVE",
        auth_user_id: "auth-id",
      }),
    ).toEqual({
      id: "profile-id",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      availability: "AVAILABLE",
      customStatus: null,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
  });
});
