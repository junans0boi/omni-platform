"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import type { Profile } from "@/store/useAppStore";
import {
  User,
  ShieldCheck,
  Bell,
  Volume2,
  Mic,
  Video,
  Globe,
  Code,
  LogOut,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  Play,
  HelpCircle,
  Sparkles,
  Sliders,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: (updated: Profile) => void;
  onLogout: () => void;
}

type NavTabKey = "account" | "notifications" | "voice" | "language" | "developer";

export function SettingsModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdate,
  onLogout,
}: SettingsModalProps) {
  const { locale } = useI18n();
  const [activeTab, setActiveTab] = useState<NavTabKey>("account");

  // Account State
  const [username, setUsername] = useState(profile?.username || "junansOboi");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [email] = useState("junansOboi@gmail.com");
  const [showEmail, setShowEmail] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone] = useState("01012346854");
  const [showPhone, setShowPhone] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Password & Security State
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Notifications General State
  const [pcNotification, setPcNotification] = useState(true);
  const [friendAnniversary, setFriendAnniversary] = useState(true);
  const [friendOnline, setFriendOnline] = useState(true);
  const [friendProfileUpdate, setFriendProfileUpdate] = useState(true);
  const [reactionNotification, setReactionNotification] = useState<"all" | "mentions" | "none">("all");

  // Notifications Sound State
  const [newMessageSound, setNewMessageSound] = useState(true);
  const [activeChannelSound, setActiveChannelSound] = useState(true);
  const [ringtoneSound, setRingtoneSound] = useState(true);
  const [disableAllSounds, setDisableAllSounds] = useState(false);

  // Voice & Video State
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [micVolume, setMicVolume] = useState<number>(80);
  const [speakerVolume, setSpeakerVolume] = useState<number>(85);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micMeterLevel, setMicMeterLevel] = useState<number>(0);
  const [inputProfile, setInputProfile] = useState<"isolation" | "studio" | "custom">("isolation");
  const [pushToTalk, setPushToTalk] = useState<boolean>(false);
  const [isTestingVideo, setIsTestingVideo] = useState<boolean>(false);
  const [alwaysPreviewVideo, setAlwaysPreviewVideo] = useState<boolean>(true);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Language & Time State
  const [timeFormat, setTimeFormat] = useState<"auto" | "12h" | "24h">("auto");

  // Fetch & Sync Preferences
  const fetchUserPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/user-preferences");
      if (res.ok) {
        const pref = await res.json();
        if (typeof pref.pcNotification === "boolean") setPcNotification(pref.pcNotification);
        if (typeof pref.friendAnniversary === "boolean") setFriendAnniversary(pref.friendAnniversary);
        if (typeof pref.friendOnline === "boolean") setFriendOnline(pref.friendOnline);
        if (typeof pref.friendProfileUpdate === "boolean") setFriendProfileUpdate(pref.friendProfileUpdate);
        if (typeof pref.reactionNotification === "string") setReactionNotification(pref.reactionNotification as "all" | "mentions" | "none");
        if (typeof pref.newMessageSound === "boolean") setNewMessageSound(pref.newMessageSound);
        if (typeof pref.activeChannelSound === "boolean") setActiveChannelSound(pref.activeChannelSound);
        if (typeof pref.ringtoneSound === "boolean") setRingtoneSound(pref.ringtoneSound);
        if (typeof pref.disableAllSounds === "boolean") setDisableAllSounds(pref.disableAllSounds);
        if (pref.micDeviceId) setSelectedMic(pref.micDeviceId);
        if (pref.speakerDeviceId) setSelectedSpeaker(pref.speakerDeviceId);
        if (pref.cameraDeviceId) setSelectedCamera(pref.cameraDeviceId);
        if (typeof pref.micVolume === "number") setMicVolume(pref.micVolume);
        if (typeof pref.speakerVolume === "number") setSpeakerVolume(pref.speakerVolume);
        if (typeof pref.inputProfile === "string") setInputProfile(pref.inputProfile as "isolation" | "studio" | "custom");
        if (typeof pref.pushToTalk === "boolean") setPushToTalk(pref.pushToTalk);
        if (typeof pref.alwaysPreviewVideo === "boolean") setAlwaysPreviewVideo(pref.alwaysPreviewVideo);
        if (typeof pref.timeFormat === "string") setTimeFormat(pref.timeFormat as "auto" | "12h" | "24h");
      }
    } catch {
      // Ignore
    }
  }, []);

  const updatePreference = async (updates: Record<string, unknown>) => {
    try {
      await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      // Ignore
    }
  };

  const handleUpdateAccount = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.user) onProfileUpdate(result.user);
        return { ok: true, data: result };
      } else {
        const error = await res.json();
        return { ok: false, error: error.error };
      }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : "Error" };
    }
  };

  // Enumerate media devices & fetch preferences
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      fetchUserPreferences();
    }, 0);

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const mics = devices.filter((d) => d.kind === "audioinput");
          const speakers = devices.filter((d) => d.kind === "audiooutput");
          const cams = devices.filter((d) => d.kind === "videoinput");
          setAudioInputs(mics);
          setAudioOutputs(speakers);
          setVideoInputs(cams);
          if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
          if (speakers.length > 0 && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
          if (cams.length > 0 && !selectedCamera) setSelectedCamera(cams[0].deviceId);
        })
        .catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [isOpen, fetchUserPreferences, selectedMic, selectedSpeaker, selectedCamera]);

  // Mic test simulation timer
  useEffect(() => {
    if (!isTestingMic) return;
    const timer = setInterval(() => {
      setMicMeterLevel(Math.floor(Math.random() * 65) + 15);
    }, 150);
    return () => {
      clearInterval(timer);
      setMicMeterLevel(0);
    };
  }, [isTestingMic]);

  // Camera preview stream handler
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isTestingVideo && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: selectedCamera ? { deviceId: selectedCamera } : true })
        .then((s) => {
          stream = s;
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = s;
          }
        })
        .catch(() => {});
    } else if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isTestingVideo, selectedCamera]);

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

  const playTestSound = () => {
    if (disableAllSounds) return;
    getSoundEffects()?.emit("INACTIVE_MESSAGE");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMsg("현재 비밀번호와 새 비밀번호를 입력해주세요.");
      return;
    }
    const res = await handleUpdateAccount({ currentPassword, newPassword });
    if (res.ok) {
      setPasswordMsg("비밀번호가 성공적으로 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => {
        setIsEditingPassword(false);
        setPasswordMsg(null);
      }, 1500);
    } else {
      setPasswordMsg(res.error || "비밀번호 변경 실패");
    }
  };

  const handleSaveUsername = async () => {
    if (isEditingUsername) {
      await handleUpdateAccount({ username });
    }
    setIsEditingUsername(!isEditingUsername);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md transition-all animate-fadeIn">
      {/* Modal Container */}
      <div className="relative flex h-[680px] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-2xl">
        
        {/* Left Navigation Sidebar */}
        <div className="w-64 shrink-0 border-r border-white/10 bg-white/[0.03] p-5 flex flex-col justify-between select-none">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white shadow-md shadow-indigo-500/30">
                ⚙️
              </div>
              <div>
                <h2 className="font-extrabold text-base leading-tight">설정</h2>
                <p className="text-[11px] text-zinc-400">Omni Platform</p>
              </div>
            </div>

            {/* Nav Group 1: 계정 */}
            <div className="mb-4 space-y-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">계정</span>
              <button
                onClick={() => setActiveTab("account")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "account"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <User className="h-4 w-4" />
                <span>계정 정보 & 보안</span>
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "notifications"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Bell className="h-4 w-4" />
                <span>알림 & 소리</span>
              </button>
            </div>

            {/* Nav Group 2: 앱 설정 */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">앱 설정</span>
              <button
                onClick={() => setActiveTab("voice")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "voice"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Mic className="h-4 w-4" />
                <span>음성 및 비디오</span>
              </button>
              <button
                onClick={() => setActiveTab("language")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "language"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>언어 및 시간</span>
              </button>
              <button
                onClick={() => setActiveTab("developer")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "developer"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Code className="h-4 w-4" />
                <span>개발자</span>
              </button>
            </div>
          </div>

          {/* Bottom Logout */}
          <div className="pt-3 border-t border-white/10">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto relative no-scrollbar">
          {/* Top Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* TAB 1: Account (계정 정보 & 보안 & 연결) */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">계정</h3>
                <p className="text-xs text-zinc-400 mt-1">사용자 계정 정보, 보안 설정 및 외부 서비스 연결을 관리합니다.</p>
              </div>

              {/* Section 1: 계정 정보 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">계정 정보</h4>

                {/* 사용자명 */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-xs text-zinc-400 block">사용자명</span>
                    {isEditingUsername ? (
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="mt-1 rounded-lg border border-indigo-500 bg-zinc-900 px-3 py-1 text-xs font-bold text-white outline-none"
                      />
                    ) : (
                      <span className="text-sm font-bold text-white">{username}</span>
                    )}
                  </div>
                  <button
                    onClick={handleSaveUsername}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>{isEditingUsername ? "완료" : "수정"}</span>
                  </button>
                </div>

                {/* 이메일 */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-xs text-zinc-400 block">이메일</span>
                    <span className="text-sm font-bold text-white tracking-wide">
                      {showEmail ? email : "**********@gmail.com"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowEmail(!showEmail)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      {showEmail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showEmail ? "숨기기" : "보이기"}</span>
                    </button>
                    <button
                      onClick={() => setIsEditingEmail(!isEditingEmail)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>수정</span>
                    </button>
                  </div>
                </div>

                {/* 전화번호 */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs text-zinc-400 block">전화번호</span>
                    <span className="text-sm font-bold text-white tracking-wide">
                      {showPhone ? phone : "*********6854"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPhone(!showPhone)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      {showPhone ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPhone ? "숨기기" : "보이기"}</span>
                    </button>
                    <button
                      onClick={() => setIsEditingPhone(!isEditingPhone)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>수정</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: 비밀번호 및 보안 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">비밀번호 및 보안</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white block">비밀번호</span>
                    <span className="text-xs text-zinc-500">계정 보안을 위해 정기적으로 비밀번호를 변경하세요.</span>
                  </div>
                  <button
                    onClick={() => setIsEditingPassword(!isEditingPassword)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-600/30 transition"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>비밀번호 수정</span>
                  </button>
                </div>

                {isEditingPassword && (
                  <form onSubmit={handlePasswordSubmit} className="mt-3 p-4 rounded-xl border border-white/10 bg-zinc-900/80 space-y-3 animate-fadeIn">
                    {passwordMsg && (
                      <div className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                        {passwordMsg}
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">현재 비밀번호</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">새 비밀번호</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingPassword(false)}
                        className="px-3 py-1 text-xs font-medium text-zinc-400 hover:text-white"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-500"
                      >
                        저장
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Section 3: 연결 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">연결</h4>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
                      G
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Google 계정 연동</span>
                      <span className="text-[11px] text-zinc-500">추후 구글 연동 서비스 제공 예정</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-white/10">
                    예정됨
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Notifications & Sound (알림 및 소리) */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">알림 & 소리</h3>
                <p className="text-xs text-zinc-400 mt-1">PC 알림 조건, 소리 모드 및 메시지 수신 효과음을 설정합니다.</p>
              </div>

              {/* 일반 알림 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">일반 알림</h4>

                {/* PC 알림 활성화 */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-sm font-bold text-white block">PC 알림 활성화</span>
                    <span className="text-xs text-zinc-500">컴퓨터 바탕 화면 알림을 표시합니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={pcNotification}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setPcNotification(v);
                      updatePreference({ pcNotification: v });
                    }}
                    className="h-5 w-5 rounded-md border-white/10 bg-indigo-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <div className="pt-2 border-t border-white/5 space-y-3">
                  <span className="text-[11px] font-bold text-zinc-400 block">다음과 같은 경우 알림</span>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-zinc-300">친구와의 우정 기념일을 달성했어요</span>
                    <input
                      type="checkbox"
                      checked={friendAnniversary}
                      onChange={(e) => setFriendAnniversary(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-zinc-300">친구가 온라인일 때</span>
                    <input
                      type="checkbox"
                      checked={friendOnline}
                      onChange={(e) => setFriendOnline(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-zinc-300">친구들의 프로필 업데이트</span>
                    <input
                      type="checkbox"
                      checked={friendProfileUpdate}
                      onChange={(e) => setFriendProfileUpdate(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-indigo-600 cursor-pointer"
                    />
                  </label>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-zinc-300">누군가가 내 메시지에 반응해요</span>
                    <select
                      value={reactionNotification}
                      onChange={(e) => setReactionNotification(e.target.value as "all" | "mentions" | "none")}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="all">모든 메시지</option>
                      <option value="mentions">멘션만</option>
                      <option value="none">비활성화</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 소리 알림 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">소리</h4>

                {/* 새로운 메시지 */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-xs font-bold text-white block">새로운 메시지</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>(미리 듣기)</span>
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMessageSound && !disableAllSounds}
                    disabled={disableAllSounds}
                    onChange={(e) => setNewMessageSound(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-indigo-600 cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* 현재 읽고 있는 채널의 신규 메시지 */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-xs font-bold text-white block">현재 읽고 있는 채널의 신규 메시지</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>(미리 듣기)</span>
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeChannelSound && !disableAllSounds}
                    disabled={disableAllSounds}
                    onChange={(e) => setActiveChannelSound(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-indigo-600 cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* 수신음 */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-xs font-bold text-white block">수신음</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>(미리 듣기)</span>
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={ringtoneSound && !disableAllSounds}
                    disabled={disableAllSounds}
                    onChange={(e) => setRingtoneSound(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-indigo-600 cursor-pointer disabled:opacity-30"
                  />
                </div>

                <label className="flex items-start justify-between cursor-pointer pt-2">
                  <div className="pr-4">
                    <span className="text-xs font-bold text-rose-400 block">모든 알림 소리 비활성화</span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                      음성 및 영상 효과음을 포함한 모든 알림 소리를 꺼요. 이 기능을 켜더라도 개별 소리 기본 설정은 저장되어 나중에 복원할 수 있어요.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={disableAllSounds}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setDisableAllSounds(v);
                      updatePreference({ disableAllSounds: v });
                    }}
                    className="h-5 w-5 shrink-0 rounded border-white/10 bg-rose-600 cursor-pointer mt-1"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Voice & Video (음성 및 비디오) */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">음성 및 비디오</h3>
                <p className="text-xs text-zinc-400 mt-1">마이크/스피커 선택, 음량, 마이크 테스트, 입력 프로필 및 카메라를 설정합니다.</p>
              </div>

              {/* 음성 설정 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">음성</h4>

                {/* 마이크 & 스피커 드롭다운 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">마이크</label>
                    <select
                      value={selectedMic}
                      onChange={(e) => setSelectedMic(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">MacBook Pro 마이크</option>
                      {audioInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `마이크 (${d.deviceId.slice(0, 6)})`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">스피커</label>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">준환의 AirPods Pro #2</option>
                      {audioOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `스피커 (${d.deviceId.slice(0, 6)})`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 마이크 음량 & 스피커 음량 슬라이더 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>마이크 음량</span>
                      <span>{micVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={micVolume}
                      onChange={(e) => setMicVolume(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>스피커 음량</span>
                      <span>{speakerVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={speakerVolume}
                      onChange={(e) => setSpeakerVolume(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 마이크 테스트 & 레벨 메터 */}
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">마이크 테스트</span>
                    <button
                      onClick={() => setIsTestingMic(!isTestingMic)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        isTestingMic
                          ? "bg-rose-600 text-white shadow-md"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      {isTestingMic ? "테스트 중지" : "마이크 테스트"}
                    </button>
                  </div>

                  {/* Meter Bar */}
                  <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-150"
                      style={{ width: `${micMeterLevel}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                  <span>도움이 필요하신가요? 문제 해결 가이드를 확인하세요.</span>
                  <a href="#help" className="text-indigo-400 hover:underline flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    <span>가이드</span>
                  </a>
                </div>

                {/* 입력 프로필 */}
                <div className="pt-3 border-t border-white/5 space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 block">입력 프로필</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setInputProfile("isolation")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "isolation"
                          ? "border-indigo-500 bg-indigo-600/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>음성 격리</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        멋진 목소리만 들려 드릴게요. 소음은 알아서 처리할게요
                      </p>
                    </button>

                    <button
                      onClick={() => setInputProfile("studio")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "studio"
                          ? "border-indigo-500 bg-indigo-600/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                        <span>스튜디오</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        순수 오디오: 프로세싱 없이 마이크 열기
                      </p>
                    </button>

                    <button
                      onClick={() => setInputProfile("custom")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "custom"
                          ? "border-indigo-500 bg-indigo-600/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                        <span>사용자 지정</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        고급 모드: 모든 버튼과 다이얼을 주세요!
                      </p>
                    </button>
                  </div>
                </div>

                {/* 눌러서 말하기 (Push-to-Talk) */}
                <label className="flex items-center justify-between cursor-pointer pt-2">
                  <span className="text-xs font-bold text-white">눌러서 말하기 (Push-to-Talk)</span>
                  <input
                    type="checkbox"
                    checked={pushToTalk}
                    onChange={(e) => setPushToTalk(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-indigo-600 cursor-pointer"
                  />
                </label>
              </div>

              {/* 카메라 설정 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">카메라</h4>

                {/* 영상 테스트 Viewport */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-zinc-900/80 min-h-[160px] relative overflow-hidden">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 h-full w-full object-cover ${isTestingVideo ? "block" : "hidden"}`}
                  />
                  {!isTestingVideo && (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Video className="h-8 w-8 text-zinc-500 stroke-1" />
                      <span className="text-xs text-zinc-400">카메라를 켜서 영상 상태를 확인하세요.</span>
                    </div>
                  )}
                  <button
                    onClick={() => setIsTestingVideo(!isTestingVideo)}
                    className="mt-3 z-10 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition"
                  >
                    {isTestingVideo ? "영상 중지" : "[영상 테스트]"}
                  </button>
                </div>

                {/* 영상 항상 미리 보기 */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-xs font-bold text-white block">영상 항상 미리 보기</span>
                    <span className="text-[11px] text-zinc-500">영상을 켤 때마다 미리 보기 모달 띄우기</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={alwaysPreviewVideo}
                    onChange={(e) => setAlwaysPreviewVideo(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-indigo-600 cursor-pointer"
                  />
                </label>

                {/* 카메라 선택 */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">카메라 장치</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">FaceTime HD 카메라</option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `카메라 (${d.deviceId.slice(0, 6)})`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Language & Time (언어 및 시간) */}
          {activeTab === "language" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">언어 및 시간</h3>
                <p className="text-xs text-zinc-400 mt-1">표시 언어와 시간 형식을 선택합니다.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">언어 선택하기</h4>
                <p className="text-xs text-zinc-400">Omni Platform에 표시할 언어를 선택하세요.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => changeLocale("ko")}
                    className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold transition ${
                      locale === "ko"
                        ? "border-indigo-500 bg-indigo-600/20 text-white shadow-md"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🇰🇷</span>
                      <span>한국어</span>
                    </div>
                    {locale === "ko" && <Check className="h-4 w-4 text-indigo-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => changeLocale("en")}
                    className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold transition ${
                      locale === "en"
                        ? "border-indigo-500 bg-indigo-600/20 text-white shadow-md"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🇺🇸</span>
                      <span>English</span>
                    </div>
                    {locale === "en" && <Check className="h-4 w-4 text-indigo-400" />}
                  </button>
                </div>
              </div>

              {/* 시간 형식 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">시간 형식</h4>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-zinc-900/60 cursor-pointer hover:bg-zinc-800/80 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="auto"
                      checked={timeFormat === "auto"}
                      onChange={() => {
                        setTimeFormat("auto");
                        updatePreference({ timeFormat: "auto" });
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-white">자동 (시스템 기본값)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-zinc-900/60 cursor-pointer hover:bg-zinc-800/80 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="12h"
                      checked={timeFormat === "12h"}
                      onChange={() => {
                        setTimeFormat("12h");
                        updatePreference({ timeFormat: "12h" });
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-white">12시간 (오후 2:30)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-zinc-900/60 cursor-pointer hover:bg-zinc-800/80 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="24h"
                      checked={timeFormat === "24h"}
                      onChange={() => {
                        setTimeFormat("24h");
                        updatePreference({ timeFormat: "24h" });
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-white">24시간 (14:30)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Developer (개발자 정보) */}
          {activeTab === "developer" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">개발자</h3>
                <p className="text-xs text-zinc-400 mt-1">플랫폼 엔진 및 빌드 정보를 확인합니다.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">개발자 정보</h4>
                
                <div className="space-y-2 text-xs font-mono text-zinc-300">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-zinc-500">App Name</span>
                    <span className="font-bold text-white">Omni Platform</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-zinc-500">Version</span>
                    <span className="font-bold text-white">0.1.0-release</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-zinc-500">Author</span>
                    <span className="font-bold text-white">Lee Junhwan (SteadyToVivid)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-zinc-500">Engine</span>
                    <span className="font-bold text-indigo-400">Next.js 15 + LiveKit + Supabase</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-500">Environment</span>
                    <span className="font-bold text-emerald-400">Production Mode</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
