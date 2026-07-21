"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PERMISSIONS, type Permission } from "@/lib/rbac-core";
import { ROLE_BADGES } from "@/lib/role-appearance";

interface RoleRecord {
  id: string;
  name: string;
  position: number;
  colorHex: string | null;
  badgeKey: string | null;
  permissions: { permission: string }[];
  memberships: { memberId: string }[];
}

interface MemberRecord {
  id: string;
  role: string;
  profile: { username: string; displayName: string | null };
  membershipRoles: { roleId: string }[];
}

interface RolePayload {
  canManageRoles: boolean;
  currentMembershipId: string;
  roles: RoleRecord[];
  members: MemberRecord[];
}

export function RoleManager({ spaceId }: { spaceId: string }) {
  const [data, setData] = useState<RolePayload | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Permission[]>([]);
  const [colorHex, setColorHex] = useState("#6366F1");
  const [badgeKey, setBadgeKey] = useState("");
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/spaces/${spaceId}/roles`);
    if (!response.ok) {
      setError(response.status === 403 ? "You cannot view roles in this Space." : "Unable to load roles.");
      return;
    }
    setData(await response.json());
  }, [spaceId]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/spaces/${spaceId}/roles`).then(async (response) => {
      if (!active) return;
      if (!response.ok) {
        setError(response.status === 403 ? "You cannot view roles in this Space." : "Unable to load roles.");
        return;
      }
      setData(await response.json());
    });
    return () => { active = false; };
  }, [spaceId]);

  const togglePermission = (permission: Permission) => {
    setSelected((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const createRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/spaces/${spaceId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, permissions: selected, colorHex, badgeKey: badgeKey || null, position }),
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Unable to create role.");
      return;
    }
    setName("");
    setSelected([]);
    await refresh();
  };

  const updateRole = async (
    role: RoleRecord,
    permissions: string[],
    appearance: Partial<Pick<RoleRecord, "position" | "colorHex" | "badgeKey">> = {},
  ) => {
    // Optimistic update: apply permissions change immediately so the checkbox
    // reflects the new state before the server responds and refresh() re-renders.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: prev.roles.map((r) => {
          if (r.id !== role.id) return r;
          return {
            ...r,
            permissions: permissions.map((permission) => ({ permission })),
            ...appearance,
          };
        }),
      };
    });
    const response = await fetch(`/api/spaces/${spaceId}/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: role.name,
        permissions,
        position: appearance.position ?? role.position,
        colorHex: appearance.colorHex === undefined ? role.colorHex : appearance.colorHex,
        badgeKey: appearance.badgeKey === undefined ? role.badgeKey : appearance.badgeKey,
      }),
    });
    if (!response.ok) setError((await response.json()).error ?? "Unable to update role.");
    await refresh();
  };

  const deleteRole = async (roleId: string) => {
    const response = await fetch(`/api/spaces/${spaceId}/roles/${roleId}`, { method: "DELETE" });
    if (!response.ok) setError((await response.json()).error ?? "Unable to delete role.");
    await refresh();
  };

  const setAssignment = async (memberId: string, roleId: string, assigned: boolean) => {
    // Optimistic update: flip the membership immediately so the checkbox reflects the
    // new state before the server responds. This prevents Playwright's check() from
    // seeing the state revert during the fetch + refresh cycle.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        members: prev.members.map((m) => {
          if (m.id !== memberId) return m;
          const membershipRoles = assigned
            ? m.membershipRoles.filter((mr) => mr.roleId !== roleId)
            : [...m.membershipRoles, { roleId }];
          return { ...m, membershipRoles };
        }),
      };
    });
    const url = `/api/spaces/${spaceId}/members/${memberId}/roles${assigned ? `?roleId=${roleId}` : ""}`;
    const response = await fetch(url, {
      method: assigned ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: assigned ? undefined : JSON.stringify({ roleId }),
    });
    if (!response.ok) setError((await response.json()).error ?? "Unable to change assignment.");
    await refresh();
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm text-indigo-300 hover:text-indigo-200" href="/dashboard">← Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-bold">Roles and permissions</h1>
        <p className="mt-2 text-zinc-400">Permissions are additive. Space owners always retain full authority.</p>
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-red-200">{error}</div>}

        {data?.canManageRoles && (
          <form onSubmit={createRole} className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold">Create role</h2>
            <label className="mt-4 block text-sm" htmlFor="role-name">Role name</label>
            <input id="role-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={50}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">Color
                <input type="color" value={colorHex} onChange={(event) => setColorHex(event.target.value.toUpperCase())}
                  className="mt-1 block h-10 w-full rounded border border-white/15 bg-black/30" />
              </label>
              <label className="text-sm">Badge
                <select value={badgeKey} onChange={(event) => setBadgeKey(event.target.value)} className="mt-1 block h-10 w-full rounded border border-white/15 bg-zinc-900 px-2">
                  <option value="">No badge</option>
                  {ROLE_BADGES.map((badge) => <option key={badge} value={badge}>{badge}</option>)}
                </select>
              </label>
              <label className="text-sm">Display position
                <input type="number" value={position} onChange={(event) => setPosition(Number(event.target.value))}
                  className="mt-1 block h-10 w-full rounded border border-white/15 bg-black/30 px-2" />
              </label>
            </div>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Permissions</legend>
              {PERMISSIONS.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(permission)} onChange={() => togglePermission(permission)} />
                  {permission}
                </label>
              ))}
            </fieldset>
            <button className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500">Create role</button>
          </form>
        )}

        <section aria-label="Custom roles" className="mt-8 grid gap-5">
          {data?.roles.map((role) => {
            const granted = new Set(role.permissions.map(({ permission }) => permission));
            return (
              <article key={role.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold" style={{ color: role.colorHex ?? undefined }}>
                    {role.name}{role.badgeKey && <span className="ml-2 text-xs text-zinc-300" aria-label={`${role.badgeKey} badge`}>[{role.badgeKey}]</span>}
                  </h2>
                  {data.canManageRoles && <button onClick={() => void deleteRole(role.id)} className="text-sm text-red-300">Delete role</button>}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">Color
                    <input type="color" defaultValue={role.colorHex ?? "#A1A1AA"} disabled={!data.canManageRoles}
                      onBlur={(event) => void updateRole(role, [...granted], { colorHex: event.currentTarget.value.toUpperCase() })}
                      className="mt-1 block h-9 w-full rounded border border-white/15 bg-black/30" />
                  </label>
                  <label className="text-sm">Badge
                    <select defaultValue={role.badgeKey ?? ""} disabled={!data.canManageRoles}
                      onChange={(event) => void updateRole(role, [...granted], { badgeKey: event.target.value || null })}
                      className="mt-1 block h-9 w-full rounded border border-white/15 bg-zinc-900 px-2">
                      <option value="">No badge</option>
                      {ROLE_BADGES.map((badge) => <option key={badge} value={badge}>{badge}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Display position
                    <input type="number" defaultValue={role.position} disabled={!data.canManageRoles}
                      onBlur={(event) => void updateRole(role, [...granted], { position: Number(event.currentTarget.value) })}
                      className="mt-1 block h-9 w-full rounded border border-white/15 bg-black/30 px-2" />
                  </label>
                </div>
                <fieldset className="mt-4 grid gap-2 sm:grid-cols-2" disabled={!data.canManageRoles}>
                  <legend className="sr-only">{role.name} permissions</legend>
                  {PERMISSIONS.map((permission) => (
                    <label key={permission} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={granted.has(permission)} onChange={() => {
                        const next = granted.has(permission)
                          ? [...granted].filter((item) => item !== permission)
                          : [...granted, permission];
                        void updateRole(role, next);
                      }} />
                      {permission}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="mt-5 grid gap-2 sm:grid-cols-2" disabled={!data.canManageRoles}>
                  <legend className="mb-2 text-sm font-medium">Members</legend>
                  {data.members.filter((member) => member.role !== "OWNER").map((member) => {
                    const assigned = member.membershipRoles.some(({ roleId }) => roleId === role.id);
                    return (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={assigned} onChange={() => void setAssignment(member.id, role.id, assigned)} />
                        {member.profile.displayName || member.profile.username}
                      </label>
                    );
                  })}
                </fieldset>
              </article>
            );
          })}
          {data && data.roles.length === 0 && <p className="text-zinc-400">No custom roles yet.</p>}
        </section>
      </div>
    </main>
  );
}
