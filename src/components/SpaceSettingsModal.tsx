"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Space,
  Member,
  Category,
  Channel,
  Profile,
} from "@/store/useAppStore";
import {
  Settings,
  Users,
  FolderTree,
  ShieldAlert,
  Copy,
  Check,
  Trash2,
  Edit2,
  Shield,
  UserMinus,
  Plus,
  LogOut,
  X,
  Compass,
  Hash,
  Volume2,
  Lock,
  Unlock,
  History,
  Palette,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";

interface SpaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
  currentProfile: Profile | null;
  members: Member[];
  categories: Category[];
  channels: Channel[];
  myRole: "OWNER" | "ADMIN" | "MEMBER" | string;
  onSpaceUpdate: () => Promise<void>;
  onDeleteSpace: () => Promise<void>;
  onLeaveSpace: () => Promise<void>;
  onMemberAction: (member: Member, action: "kick" | "promote" | "demote") => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

export interface RolePermissionItem {
  permission: string;
}

export interface RoleItem {
  id: string;
  spaceId: string;
  name: string;
  colorHex: string | null;
  position: number;
  permissions: RolePermissionItem[];
  _count?: { memberships: number };
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetName: string | null;
  details: string | null;
  createdAt: string;
}

type TabKey = "overview" | "roles" | "members" | "channels" | "audit" | "danger";

const STANDARD_PERMISSIONS = [
  { key: "MANAGE_SPACE", label: "스페이스 관리", desc: "스페이스 프로필 및 이름 수정" },
  { key: "MANAGE_ROLES", label: "역할 관리", desc: "커스텀 역할 생성 및 멤버 역할 관리" },
  { key: "MANAGE_CHANNELS", label: "채널 관리", desc: "카테고리/채널 생성, 삭제 및 비공개 설정" },
  { key: "KICK_MEMBERS", label: "멤버 내보내기", desc: "스페이스에서 멤버 추방" },
  { key: "MANAGE_MESSAGES", label: "메시지 관리", desc: "채널 내 타인 메시지 삭제" },
  { key: "SPEAK_VOICE", label: "음성 발언 / 이동", desc: "음성 채널 발언 및 멤버 이동 권한" },
];

export function SpaceSettingsModal({
  isOpen,
  onClose,
  space,
  currentProfile,
  members,
  categories,
  channels,
  myRole,
  onSpaceUpdate,
  onDeleteSpace,
  onLeaveSpace,
  onMemberAction,
  onDeleteChannel,
  onDeleteCategory,
}: SpaceSettingsModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Overview Form State
  const [spaceName, setSpaceName] = useState(space?.name || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(space?.avatarUrl || null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Roles State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showRoleCreate, setShowRoleCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#8b5cf6");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(["MANAGE_CHANNELS", "SPEAK_VOICE"])
  );

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Member Role Popover State
  const [activeMemberRolePopover, setActiveMemberRolePopover] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const isAdminOrOwner = ["OWNER", "ADMIN"].includes(myRole);

  const [prevSpaceId, setPrevSpaceId] = useState<string | null>(null);
  if (space && space.id !== prevSpaceId) {
    setPrevSpaceId(space.id);
    setSpaceName(space.name || "");
    setAvatarPreview(space.avatarUrl || null);
    setAvatarFile(null);
  }

  const fetchRoles = useCallback(async () => {
    if (!space) return;
    setLoadingRoles(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}/roles`);
      if (res.ok) {
        setRoles(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoadingRoles(false);
    }
  }, [space]);

  const fetchAuditLogs = useCallback(async () => {
    if (!space) return;
    setLoadingAudit(true);
    try {
      const url = auditFilter === "ALL"
        ? `/api/spaces/${space.id}/audit-logs`
        : `/api/spaces/${space.id}/audit-logs?action=${auditFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoadingAudit(false);
    }
  }, [space, auditFilter]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === "roles") fetchRoles();
    if (tab === "audit") fetchAuditLogs();
  };

  const handleFilterChange = async (filter: string) => {
    setAuditFilter(filter);
    if (!space) return;
    setLoadingAudit(true);
    try {
      const url = filter === "ALL"
        ? `/api/spaces/${space.id}/audit-logs`
        : `/api/spaces/${space.id}/audit-logs?action=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoadingAudit(false);
    }
  };

  if (!isOpen || !space) return null;

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner || !spaceName.trim()) return;

    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      let avatarUrl = space.avatarUrl || null;
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upRes.ok) avatarUrl = upData.url;
        else {
          setFormError(upData.error || "Image upload failed");
          setFormLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: spaceName.trim(),
          avatarUrl,
        }),
      });

      if (res.ok) {
        setFormSuccess("스페이스 설정이 저장되었습니다.");
        await onSpaceUpdate();
      } else {
        const errData = await res.json();
        setFormError(errData.error || "수정 실패");
      }
    } catch {
      setFormError("오류가 발생했습니다.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/spaces/${space.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          colorHex: newRoleColor,
          permissions: Array.from(selectedPermissions),
        }),
      });

      if (res.ok) {
        setNewRoleName("");
        setShowRoleCreate(false);
        await fetchRoles();
      } else {
        const err = await res.json();
        setFormError(err.error || "역할 생성 실패");
      }
    } catch {
      setFormError("오류가 발생했습니다.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("이 커스텀 역할을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/spaces/${space.id}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchRoles();
      }
    } catch {
      // Ignore
    }
  };

  const handleToggleChannelPrivate = async (channelId: string, currentPrivate: boolean) => {
    try {
      const res = await fetch(`/api/spaces/${space.id}/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: !currentPrivate }),
      });
      if (res.ok) {
        await onSpaceUpdate();
      }
    } catch {
      // Ignore
    }
  };

  const handleToggleMemberRole = async (memberId: string, roleId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await fetch(`/api/spaces/${space.id}/members/${memberId}/roles?roleId=${roleId}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`/api/spaces/${space.id}/members/${memberId}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId }),
        });
      }
      await onSpaceUpdate();
      await fetchRoles();
    } catch {
      // Ignore
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(space.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const togglePermission = (key: string) => {
    const next = new Set(selectedPermissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPermissions(next);
  };

  const actionBadgeClass = (action: string) => {
    if (action.startsWith("ROLE")) return "bg-accent/20 text-accent border-accent/30";
    if (action.startsWith("MEMBER")) return "bg-online/20 text-online border-online/30";
    if (action.startsWith("CHANNEL")) return "bg-idle/20 text-idle border-idle/30";
    return "bg-surface-3 text-muted border-line";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[640px] w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Left Sidebar Tabs */}
        <aside className="w-60 border-r border-line bg-surface-2 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div className="px-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                스페이스 설정
              </h2>
              <p className="truncate text-sm font-extrabold text-text mt-0.5">
                {space.name}
              </p>
            </div>

            <nav className="space-y-1">
              <button
                onClick={() => handleTabChange("overview")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "overview"
                    ? "bg-accent text-on-accent shadow-md"
                    : "text-muted hover:bg-surface-3 hover:text-text"
                }`}
              >
                <Compass className="h-4 w-4" />
                <span>개요 및 프로필</span>
              </button>

              <button
                onClick={() => handleTabChange("roles")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "roles"
                    ? "bg-accent text-on-accent shadow-md"
                    : "text-muted hover:bg-surface-3 hover:text-text"
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>역할 및 권한</span>
              </button>

              <button
                onClick={() => handleTabChange("members")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "members"
                    ? "bg-accent text-on-accent shadow-md"
                    : "text-muted hover:bg-surface-3 hover:text-text"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>멤버 관리 ({members.length})</span>
              </button>

              <button
                onClick={() => handleTabChange("channels")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "channels"
                    ? "bg-accent text-on-accent shadow-md"
                    : "text-muted hover:bg-surface-3 hover:text-text"
                }`}
              >
                <FolderTree className="h-4 w-4" />
                <span>채널 & 권한 락</span>
              </button>

              <button
                onClick={() => handleTabChange("audit")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "audit"
                    ? "bg-accent text-on-accent shadow-md"
                    : "text-muted hover:bg-surface-3 hover:text-text"
                }`}
              >
                <History className="h-4 w-4" />
                <span>감사 로그 (Audit)</span>
              </button>

              <button
                onClick={() => handleTabChange("danger")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === "danger"
                    ? "bg-danger text-on-accent shadow-md"
                    : "text-danger hover:bg-danger/10"
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>위험 지역</span>
              </button>
            </nav>
          </div>

          <div className="pt-4 border-t border-line">
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-2 text-xs font-bold text-muted hover:bg-surface-3 hover:text-text transition"
            >
              <X className="h-4 w-4" />
              <span>닫기 (ESC)</span>
            </button>
          </div>
        </aside>

        {/* Right Main Content */}
        <main className="flex-1 overflow-y-auto p-8 pb-24 bg-surface">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <form onSubmit={handleSaveOverview} className="max-w-lg space-y-6">
              <div>
                <h3 className="text-lg font-bold text-text">스페이스 프로필 및 개요</h3>
                <p className="text-xs text-muted mt-1">
                  스페이스 이름과 대표 이미지를 수정하고 초대 코드를 관리합니다.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div
                  className="relative group overflow-hidden rounded-full h-24 w-24 border-4 border-line bg-surface-2 flex items-center justify-center cursor-pointer shrink-0"
                  onClick={() => {
                    if (isAdminOrOwner) document.getElementById("space-avatar-input")?.click();
                  }}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold uppercase text-accent">
                      {spaceName.substring(0, 2) || "??"}
                    </span>
                  )}

                  {isAdminOrOwner && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-xs font-bold text-white">
                      <Edit2 className="h-4 w-4 mb-1" />
                      변경
                    </div>
                  )}

                  <input
                    type="file"
                    id="space-avatar-input"
                    accept="image/*"
                    className="hidden"
                    disabled={!isAdminOrOwner}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setAvatarFile(f);
                      const r = new FileReader();
                      r.onload = () => setAvatarPreview(r.result as string);
                      r.readAsDataURL(f);
                    }}
                  />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-text">스페이스 대표 아이콘</h4>
                  <p className="text-xs text-muted mt-1">
                    권장 이미지: 512x512px (PNG, JPG, WEBP)
                  </p>
                  {avatarFile && (
                    <span className="text-[11px] font-semibold text-accent mt-2 block truncate max-w-xs">
                      새 파일: {avatarFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  스페이스 이름
                </label>
                <input
                  type="text"
                  value={spaceName}
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="스페이스 이름을 입력하세요"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-text placeholder-muted outline-none transition focus:border-accent disabled:opacity-60"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-line">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  초대 코드 (INVITE CODE)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={space.inviteCode}
                    className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-mono text-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="flex items-center gap-1.5 rounded-xl bg-accent-soft px-4 py-2.5 text-xs font-bold text-accent border border-accent/30 transition hover:bg-accent-soft"
                  >
                    {copiedInvite ? <Check className="h-4 w-4 text-online" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedInvite ? "복사됨!" : "코드 복사"}</span>
                  </button>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-xl border border-online/30 bg-online/10 p-3 text-xs text-online">
                  {formSuccess}
                </div>
              )}

              {isAdminOrOwner && (
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={formLoading || !spaceName.trim()}
                    className="rounded-xl bg-accent px-6 py-3 text-xs font-bold text-on-accent shadow-lg shadow-[0_4px_12px_-2px_var(--accent)] transition hover:bg-accent-strong disabled:opacity-50"
                  >
                    {formLoading ? "저장 중..." : "변경 사항 저장"}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: ROLES & PERMISSIONS */}
          {activeTab === "roles" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text">커스텀 역할 및 권한 체계</h3>
                  <p className="text-xs text-muted mt-1">
                    디스코드 방식의 역할 생성, 색상 지정 및 세부 권한을 설정합니다.
                  </p>
                </div>
                {isAdminOrOwner && (
                  <button
                    onClick={() => setShowRoleCreate((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-on-accent transition hover:bg-accent-strong shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>새 역할 만들기</span>
                  </button>
                )}
              </div>

              {/* Role Creation Form */}
              {showRoleCreate && (
                <form onSubmit={handleCreateRole} className="rounded-2xl border border-accent/40 bg-surface-2 p-5 space-y-4 shadow-lg">
                  <h4 className="font-bold text-sm text-text flex items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" />
                    새 커스텀 역할 생성
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-muted block mb-1">
                        역할 이름
                      </label>
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="예: 백엔드 팀장, 디자이너"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-text outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-muted block mb-1">
                        역할 라벨 색상 (Color)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newRoleColor}
                          onChange={(e) => setNewRoleColor(e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent p-0.5"
                        />
                        <span className="text-xs font-mono text-muted">{newRoleColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-muted block mb-2">
                      부여할 세부 권한 목록 (Permissions)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {STANDARD_PERMISSIONS.map((perm) => {
                        const checked = selectedPermissions.has(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                              checked
                                ? "border-accent bg-accent-soft text-text font-semibold"
                                : "border-line bg-surface text-muted hover:bg-surface-3"
                            }`}
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            ) : (
                              <Square className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="text-xs block font-bold">{perm.label}</span>
                              <span className="text-[10px] text-muted block leading-tight">
                                {perm.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRoleCreate(false)}
                      className="rounded-xl px-4 py-2 text-xs font-bold text-muted hover:bg-surface-3 transition"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={formLoading || !newRoleName.trim()}
                      className="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:opacity-50"
                    >
                      역할 생성
                    </button>
                  </div>
                </form>
              )}

              {/* Roles List */}
              {loadingRoles ? (
                <div className="py-12 text-center text-xs text-muted">역할 목록 불러오는 중...</div>
              ) : roles.length === 0 ? (
                <div className="rounded-2xl border border-line p-8 text-center text-xs text-muted">
                  아직 생성된 커스텀 역할이 없습니다. [새 역할 만들기] 버튼으로 첫 커스텀 역할을 부여해 보세요!
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-line bg-surface-2 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full border border-line shrink-0"
                          style={{ backgroundColor: r.colorHex || "#808080" }}
                        />
                        <div>
                          <h4 className="font-bold text-sm text-text flex items-center gap-2">
                            <span>{r.name}</span>
                            <span className="text-[10px] text-muted font-normal">
                              ({r.permissions.length}개 권한 부여됨)
                            </span>
                          </h4>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.permissions.map((p) => {
                              const detail = STANDARD_PERMISSIONS.find((sp) => sp.key === p.permission);
                              return (
                                <span
                                  key={p.permission}
                                  className="px-2 py-0.5 rounded bg-surface border border-line text-[10px] text-muted font-medium"
                                >
                                  {detail?.label || p.permission}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {isAdminOrOwner && (
                        <button
                          onClick={() => handleDeleteRole(r.id)}
                          className="p-2 rounded-xl text-muted hover:bg-danger/20 hover:text-danger transition"
                          title="역할 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === "members" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-text">멤버 목록 및 권한 관리</h3>
                <p className="text-xs text-muted mt-1">
                  스페이스 소속 멤버들의 역할을 변경하거나 내보낼 수 있습니다.
                </p>
              </div>

              <div className="space-y-2 border border-line rounded-2xl overflow-hidden divide-y divide-line bg-surface-2">
                {members.map((member) => {
                  const isMe = member.profileId === currentProfile?.id;
                  return (
                    <div key={member.id} className="p-4 flex flex-col gap-3 transition hover:bg-surface-3/30">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
                            {member.profile?.avatarUrl ? (
                              <img src={member.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              member.profile?.username.slice(0, 2) || "??"
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-text">
                                {member.profile?.displayName || member.profile?.username}
                              </span>
                              {isMe && (
                                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent border border-accent/20">
                                  나
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted block">@{member.profile?.username}</span>

                            {/* Custom Role Badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {member.membershipRoles?.map((mr) => (
                                <span
                                  key={mr.roleId}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs flex items-center gap-1"
                                  style={{ backgroundColor: mr.role.colorHex || "#808080" }}
                                >
                                  {mr.role.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              member.role === "OWNER"
                                ? "bg-accent/20 text-accent border border-accent/30"
                                : member.role === "ADMIN"
                                ? "bg-online/20 text-online border border-online/30"
                                : "bg-surface text-muted"
                            }`}
                          >
                            {member.role}
                          </span>

                          {isAdminOrOwner && (
                            <button
                              onClick={() =>
                                setActiveMemberRolePopover((prev) => (prev === member.id ? null : member.id))
                              }
                              title="역할 부여 / 해제"
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-accent-soft text-accent border border-accent/30 hover:bg-accent-soft transition flex items-center gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>역할 선택</span>
                            </button>
                          )}

                          {isAdminOrOwner && !isMe && member.role !== "OWNER" && (
                            <div className="flex gap-1">
                              {member.role !== "ADMIN" && (
                                <button
                                  onClick={() => onMemberAction(member, "promote")}
                                  title="관리자(ADMIN) 승격"
                                  className="p-2 rounded-lg bg-surface hover:bg-accent-soft text-muted hover:text-accent transition"
                                >
                                  <Shield className="h-4 w-4" />
                                </button>
                              )}
                              {member.role === "ADMIN" && myRole === "OWNER" && (
                                <button
                                  onClick={() => onMemberAction(member, "demote")}
                                  title="일반 멤버(MEMBER) 강등"
                                  className="p-2 rounded-lg bg-surface hover:bg-idle/20 text-muted hover:text-idle transition"
                                >
                                  <Shield className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => onMemberAction(member, "kick")}
                                title="멤버 내보내기"
                                className="p-2 rounded-lg bg-surface hover:bg-danger/20 text-muted hover:text-danger transition"
                              >
                                <UserMinus className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Inline Expandable Role Selector Panel */}
                      {activeMemberRolePopover === member.id && (
                        <div className="mt-2 rounded-xl border border-accent/30 bg-surface p-3 space-y-2 shadow-inner">
                          <span className="text-[11px] font-extrabold uppercase text-accent tracking-wider block">
                            커스텀 역할 부여 / 해제 (원클릭 토글)
                          </span>
                          {roles.length === 0 ? (
                            <p className="text-xs text-muted">
                              생성된 커스텀 역할이 없습니다. 먼저 왼쪽 [역할 및 권한] 탭에서 역할을 만들어 보세요!
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {roles.map((r) => {
                                const isAssigned = Boolean(
                                  member.membershipRoles?.some((mr) => mr.roleId === r.id)
                                );
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => handleToggleMemberRole(member.id, r.id, isAssigned)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                                      isAssigned
                                        ? "border-accent bg-accent-soft text-accent shadow-xs"
                                        : "border-line bg-surface-2 text-muted hover:bg-surface-3 hover:text-text"
                                    }`}
                                  >
                                    <div
                                      className="h-3 w-3 rounded-full shrink-0"
                                      style={{ backgroundColor: r.colorHex || "#808080" }}
                                    />
                                    <span>{r.name}</span>
                                    {isAssigned ? (
                                      <Check className="h-3.5 w-3.5 text-accent ml-1" />
                                    ) : (
                                      <Plus className="h-3.5 w-3.5 text-muted ml-1" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: CHANNELS & LOCK */}
          {activeTab === "channels" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-text">채널 구성 및 비공개 락(Lock) 관리</h3>
                <p className="text-xs text-muted mt-1">
                  채널별 비공개 🔒 토글 및 접근 가능 인원 구조를 제어합니다.
                </p>
              </div>

              <div className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
                        📁 {cat.name}
                      </span>
                      {isAdminOrOwner && (
                        <button
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-1.5 rounded-lg text-muted hover:bg-danger/20 hover:text-danger transition text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>카테고리 삭제</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 pl-2">
                      {channels
                        .filter((c) => c.categoryId === cat.id)
                        .map((ch) => (
                          <div
                            key={ch.id}
                            className="flex items-center justify-between rounded-xl border border-line/50 bg-surface px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              {ch.type === "TEXT" ? (
                                <Hash className="h-4 w-4 text-muted" />
                              ) : (
                                <Volume2 className="h-4 w-4 text-accent" />
                              )}
                              <span className="font-semibold text-text">{ch.name}</span>
                              {ch.isPrivate && (
                                <span className="flex items-center gap-1 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger border border-danger/20">
                                  <Lock className="h-3 w-3" /> 비공개
                                </span>
                              )}
                            </div>

                            {isAdminOrOwner && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleChannelPrivate(ch.id, Boolean(ch.isPrivate))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                                    ch.isPrivate
                                      ? "bg-danger/20 text-danger border-danger/30 hover:bg-danger/30"
                                      : "bg-surface-2 text-muted border-line hover:text-text"
                                  }`}
                                >
                                  {ch.isPrivate ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                  <span>{ch.isPrivate ? "비공개 됨" : "공개 채널"}</span>
                                </button>

                                <button
                                  onClick={() => onDeleteChannel(ch.id)}
                                  className="p-1.5 rounded-lg text-muted hover:bg-danger/20 hover:text-danger transition"
                                  title="채널 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text">감사 로그 (Audit Logs)</h3>
                  <p className="text-xs text-muted mt-1">
                    관리자 및 멤버들의 주요 작업 및 이력을 실시간으로 추적합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted" />
                  <select
                    value={auditFilter}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-text outline-none"
                  >
                    <option value="ALL">전체 작업 유형</option>
                    <option value="ROLE_CREATE">역할 생성</option>
                    <option value="ROLE_UPDATE">역할 수정</option>
                    <option value="ROLE_DELETE">역할 삭제</option>
                    <option value="MEMBER_KICK">멤버 추방</option>
                    <option value="MEMBER_ROLE_UPDATE">멤버 역할 변경</option>
                    <option value="SPACE_UPDATE">스페이스 프로필 수정</option>
                  </select>
                </div>
              </div>

              {loadingAudit ? (
                <div className="py-12 text-center text-xs text-muted">감사 로그 불러오는 중...</div>
              ) : auditLogs.length === 0 ? (
                <div className="rounded-2xl border border-line p-8 text-center text-xs text-muted">
                  기록된 감사 로그가 없습니다.
                </div>
              ) : (
                <div className="space-y-2 border border-line rounded-2xl overflow-hidden divide-y divide-line bg-surface-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded-lg font-mono font-bold text-[10px] border shrink-0 ${actionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <div>
                          <p className="font-bold text-text">
                            <span className="text-accent">{log.actorName}</span> 님이{" "}
                            {log.details || log.targetName || "작업을 수행했습니다."}
                          </p>
                          {log.targetName && (
                            <span className="text-[10px] text-muted block mt-0.5">
                              대상: {log.targetName}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-muted shrink-0 font-mono">
                        {new Date(log.createdAt).toLocaleString([], {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DANGER ZONE */}
          {activeTab === "danger" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-danger">위험 지역 (Danger Zone)</h3>
                <p className="text-xs text-muted mt-1">
                  스페이스 탈퇴 또는 삭제 작업을 진행합니다. 이 작업은 취소할 수 없습니다.
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-danger/30 bg-danger/10 p-6">
                {myRole === "OWNER" ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-text">스페이스 삭제</h4>
                      <p className="text-xs text-muted mt-1">
                        스페이스와 관련된 모든 채널, 카테고리, 메시지 데이터가 완전히 삭제됩니다.
                      </p>
                    </div>
                    <button
                      onClick={onDeleteSpace}
                      className="shrink-0 rounded-xl bg-danger px-5 py-2.5 text-xs font-bold text-on-accent transition hover:bg-danger/90"
                    >
                      스페이스 삭제
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-text">스페이스 탈퇴</h4>
                      <p className="text-xs text-muted mt-1">
                        스페이스에서 나가며, 재입장하려면 다시 초대 코드가 필요합니다.
                      </p>
                    </div>
                    <button
                      onClick={onLeaveSpace}
                      className="shrink-0 rounded-xl bg-danger px-5 py-2.5 text-xs font-bold text-on-accent transition hover:bg-danger/90"
                    >
                      스페이스 탈퇴
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
