"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import type { Profile } from "@/store/useAppStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: (updated: Profile) => void;
  onLogout: () => void;
}

type TabKey = "profile" | "voice" | "appearance" | "security";

interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdate,
  onLogout,
}: SettingsModalProps) {
  const { locale, t } = useI18n();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);

  const changeLocale = async (nextLocale: "ko" | "en") => {
    try {
      const res = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (res.ok) window.location.reload();
    } catch {
      // Ignore
    }
  };

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // Profile tab state
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");
  const [availability, setAvailability] = useState<"AVAILABLE" | "IDLE" | "DND">(
    (profile?.availability as "AVAILABLE" | "IDLE" | "DND") || "AVAILABLE"
  );
  const [customStatus, setCustomStatus] = useState(profile?.customStatus || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Voice & Video state
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [shareSystemAudio, setShareSystemAudio] = useState(true);

  // Security & Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // Ignore fallback
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Enumerate media devices if supported
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
          setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
          setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
        })
        .catch(() => {});
    }

    // Fetch active sessions
    const timer = setTimeout(() => {
      fetchSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, fetchSessions]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          availability,
          customStatus: customStatus.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onProfileUpdate(data.user);
        setProfileMsg("프로필 설정이 성공적으로 저장되었습니다.");
        getSoundEffects()?.emit("INACTIVE_MESSAGE");
      } else {
        setProfileMsg("프로필 저장에 실패했습니다.");
      }
    } catch {
      setProfileMsg("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE" });
      if (res.ok) {
        setSecurityMsg(t("settings.security.revokeSuccess"));
        fetchSessions();
        getSoundEffects()?.emit("INACTIVE_MESSAGE");
      }
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-all animate-fadeIn">
      {/* Modal Card */}
      <div className="relative flex h-[620px] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-slate-950/90 text-white shadow-2xl shadow-indigo-950/50 backdrop-blur-2xl">
        
        {/* Left Sidebar Navigation */}
        <div className="w-64 border-r border-white/10 bg-white/5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white shadow-lg shadow-indigo-500/30">
                ⚙️
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">{t("settings.title")}</h2>
                <p className="text-xs text-zinc-400">Omni Platform Preferences</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === "profile"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>👤</span>
                <span>{t("settings.tab.profile")}</span>
              </button>

              <button
                onClick={() => setActiveTab("voice")}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === "voice"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>🎙️</span>
                <span>{t("settings.tab.voice")}</span>
              </button>

              <button
                onClick={() => setActiveTab("appearance")}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === "appearance"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>🎨</span>
                <span>{t("settings.tab.appearance")}</span>
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === "security"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>🔒</span>
                <span>{t("settings.tab.security")}</span>
              </button>
            </nav>
          </div>

          {/* Logout button in sidebar */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
            >
              <span>🚪</span>
              <span>{t("profile.logout")}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto relative">
          {/* Close X Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>

          {/* TAB 1: Profile Settings */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings.tab.profile")}</h3>
                <p className="text-xs text-zinc-400 mt-1">개인 프로필 정보 및 사용자 존재 상태를 설정합니다.</p>
              </div>

              {profileMsg && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300">
                  {profileMsg}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("profile.displayName")}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:bg-white/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    아바타 이미지 URL
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:bg-white/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("profile.availability")}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAvailability("AVAILABLE")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition ${
                        availability === "AVAILABLE"
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{t("profile.availability.available")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailability("IDLE")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition ${
                        availability === "IDLE"
                          ? "border-amber-500 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span>{t("profile.availability.idle")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailability("DND")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition ${
                        availability === "DND"
                          ? "border-rose-500 bg-rose-500/20 text-rose-300"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span>{t("profile.availability.dnd")}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("profile.customStatus")}
                  </label>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="오늘 하루도 힘차게!"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:bg-white/10"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {savingProfile ? t("common.loading") : t("common.save")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Voice & Video Settings */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings.tab.voice")}</h3>
                <p className="text-xs text-zinc-400 mt-1">마이크, 스피커 및 카메라 장치와 노이즈 필터를 설정합니다.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("settings.voice.input")}
                  </label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
                  >
                    <option value="" className="bg-slate-900 text-white">기본 마이크 (Default Input)</option>
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                        {d.label || `마이크 ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("settings.voice.output")}
                  </label>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
                  >
                    <option value="" className="bg-slate-900 text-white">기본 스피커 (Default Output)</option>
                    {audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                        {d.label || `스피커 ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("settings.voice.camera")}
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
                  >
                    <option value="" className="bg-slate-900 text-white">기본 웹캠 (Default Camera)</option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                        {d.label || `카메라 ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 space-y-3">
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer transition hover:bg-white/10">
                    <div>
                      <span className="text-sm font-medium text-white">{t("settings.voice.noise")}</span>
                      <p className="text-xs text-zinc-400">주변 소음을 지능적으로 감소시킵니다.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={(e) => setNoiseSuppression(e.target.checked)}
                      className="h-5 w-5 rounded-md border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer transition hover:bg-white/10">
                    <div>
                      <span className="text-sm font-medium text-white">{t("settings.voice.echo")}</span>
                      <p className="text-xs text-zinc-400">스피커 소리가 마이크로 재입력되는 하울링을 방지합니다.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={echoCancellation}
                      onChange={(e) => setEchoCancellation(e.target.checked)}
                      className="h-5 w-5 rounded-md border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer transition hover:bg-white/10">
                    <div>
                      <span className="text-sm font-medium text-white">{t("settings.voice.shareAudio")}</span>
                      <p className="text-xs text-zinc-400">화면 공유 시 PC에서 재생되는 오디오를 함께 공유합니다.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={shareSystemAudio}
                      onChange={(e) => setShareSystemAudio(e.target.checked)}
                      className="h-5 w-5 rounded-md border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Appearance & Sound */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings.tab.appearance")}</h3>
                <p className="text-xs text-zinc-400 mt-1">다국어 선택 및 앱 효과음을 설정합니다.</p>
              </div>

              <div className="space-y-4">
                {/* Language selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t("settings.locale.label")}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => changeLocale("ko")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-sm font-medium transition ${
                        locale === "ko"
                          ? "border-indigo-500 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <span>🇰🇷</span>
                      <span>{t("settings.locale.ko")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => changeLocale("en")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-sm font-medium transition ${
                        locale === "en"
                          ? "border-indigo-500 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <span>🇺🇸</span>
                      <span>{t("settings.locale.en")}</span>
                    </button>
                  </div>
                </div>

                {/* Sound effects */}
                <div className="pt-2 space-y-3">
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer transition hover:bg-white/10">
                    <div>
                      <span className="text-sm font-medium text-white">{t("settings.sound.enabled")}</span>
                      <p className="text-xs text-zinc-400">메시지 수신 및 알림 시 효과음을 재생합니다.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="h-5 w-5 rounded-md border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  {soundEnabled && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{t("settings.sound.volume")}</span>
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Security & Sessions */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings.tab.security")}</h3>
                <p className="text-xs text-zinc-400 mt-1">계정에 활성화된 세션을 관리하고 보안 로그아웃을 수행합니다.</p>
              </div>

              {securityMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  {securityMsg}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {t("settings.security.activeSessions")} ({sessions.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                  >
                    {t("settings.security.revokeAll")}
                  </button>
                </div>

                {loadingSessions ? (
                  <div className="py-8 text-center text-xs text-zinc-500">{t("common.loading")}</div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">💻</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">
                                {s.isCurrent ? t("settings.security.current") : "Session ID: " + s.id.slice(0, 8)}
                              </span>
                              {s.isCurrent && (
                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500">
                              생성: {new Date(s.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
