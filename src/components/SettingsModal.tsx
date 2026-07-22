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
  Palette,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: (updated: Profile) => void;
  onLogout: () => void;
  currentThemeName: "default" | "transmission" | "night-signal";
  currentThemeMode: "light" | "dark";
  onThemeChange: (name: "default" | "transmission" | "night-signal", mode: "light" | "dark") => void;
}

type NavTabKey = "account" | "notifications" | "voice" | "language" | "appearance" | "developer";

export function SettingsModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdate,
  onLogout,
  currentThemeName,
  currentThemeMode,
  onThemeChange,
}: SettingsModalProps) {
  const { locale } = useI18n();
  const [activeTab, setActiveTab] = useState<NavTabKey>("account");

  // Account State
  const [username, setUsername] = useState(profile?.username || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [email, setEmail] = useState(profile?.email || "");
  const [showEmail, setShowEmail] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || "");
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
  const [micLoopback, setMicLoopback] = useState<boolean>(true);
  const [micMeterLevel, setMicMeterLevel] = useState<number>(0);
  const [inputProfile, setInputProfile] = useState<"isolation" | "studio" | "custom">("isolation");
  const [pushToTalk, setPushToTalk] = useState<boolean>(false);
  const [isTestingVideo, setIsTestingVideo] = useState<boolean>(false);
  const [alwaysPreviewVideo, setAlwaysPreviewVideo] = useState<boolean>(true);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Language & Time State
  const [timeFormat, setTimeFormat] = useState<"auto" | "12h" | "24h">("auto");

  // Appearance / Theme State
  const [themeNameLocal, setThemeNameLocal] = useState<"default" | "transmission" | "night-signal">(currentThemeName);
  const [themeModeLocal, setThemeModeLocal] = useState<"light" | "dark">(currentThemeMode);

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
        if (typeof pref.themeName === "string" && ["default","transmission","night-signal"].includes(pref.themeName)) setThemeNameLocal(pref.themeName);
        if (typeof pref.themeMode === "string" && ["light","dark"].includes(pref.themeMode)) setThemeModeLocal(pref.themeMode);
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
      fetch("/api/auth/account")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            if (data.user.username) setUsername(data.user.username);
            if (data.user.email) setEmail(data.user.email);
            if (data.user.phone) setPhone(data.user.phone);
          }
        })
        .catch(() => {});
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

  // Real Microphone Audio Analyser Engine with Loopback Support
  useEffect(() => {
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animFrame: number;
    let fallbackTimer: NodeJS.Timeout;

    if (isTestingMic && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      const constraints = selectedMic ? { audio: { deviceId: { exact: selectedMic } } } : { audio: true };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((s) => {
          stream = s;
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaStreamSource(s);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          // Audio Loopback Node (allows user to hear own voice during test)
          const loopbackGain = audioCtx.createGain();
          loopbackGain.gain.setValueAtTime(micLoopback ? Math.max(0.05, micVolume / 100) : 0, audioCtx.currentTime);
          source.connect(loopbackGain);
          loopbackGain.connect(audioCtx.destination);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const average = sum / dataArray.length;
            setMicMeterLevel(Math.min(100, Math.round((average / 128) * 100)));
            animFrame = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        })
        .catch(() => {
          fallbackTimer = setInterval(() => {
            setMicMeterLevel(Math.floor(Math.random() * 55) + 20);
          }, 150);
        });
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close();
      setMicMeterLevel(0);
    };
  }, [isTestingMic, selectedMic, micLoopback, micVolume]);

  // Camera preview stream handler
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isTestingVideo && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      const constraints = selectedCamera ? { video: { deviceId: { exact: selectedCamera } } } : { video: true };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((s) => {
          stream = s;
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = s;
          }
        })
        .catch(() => {
          navigator.mediaDevices.getUserMedia({ video: true }).then((s) => {
            stream = s;
            if (videoPreviewRef.current) videoPreviewRef.current.srcObject = s;
          }).catch(() => {});
        });
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

  const handleSaveEmail = async () => {
    if (isEditingEmail) {
      await handleUpdateAccount({ email });
    }
    setIsEditingEmail(!isEditingEmail);
  };

  const handleSavePhone = async () => {
    if (isEditingPhone) {
      await handleUpdateAccount({ phone });
    }
    setIsEditingPhone(!isEditingPhone);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-all animate-fadeIn">
      {/* Modal Container */}
      <div className="relative flex h-[90vh] max-h-[700px] w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-bg-elevated text-text shadow-2xl backdrop-blur-2xl">
        {/* Fixed Top Right Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-muted shadow-xl transition hover:bg-danger hover:border-danger hover:text-white"
          title="닫기 (Esc)"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Navigation Sidebar */}
        <div className="w-64 shrink-0 border-r border-line bg-surface p-5 flex flex-col justify-between select-none">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-bold text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]">
                ⚙️
              </div>
              <div>
                <h2 className="font-extrabold text-base leading-tight">설정</h2>
                <p className="text-[11px] text-muted">Omni Platform</p>
              </div>
            </div>

            {/* Nav Group 1: 계정 */}
            <div className="mb-4 space-y-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted">계정</span>
              <button
                onClick={() => setActiveTab("account")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "account"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <User className="h-4 w-4" />
                <span>계정 정보 & 보안</span>
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "notifications"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Bell className="h-4 w-4" />
                <span>알림 & 소리</span>
              </button>
            </div>

            {/* Nav Group 2: 앱 설정 */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted">앱 설정</span>
              <button
                onClick={() => setActiveTab("voice")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "voice"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Mic className="h-4 w-4" />
                <span>음성 및 비디오</span>
              </button>
              <button
                onClick={() => setActiveTab("language")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "language"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>언어 및 시간</span>
              </button>
              <button
                onClick={() => setActiveTab("appearance")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "appearance"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Palette className="h-4 w-4" />
                <span>테마</span>
              </button>
              <button
                onClick={() => setActiveTab("developer")}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "developer"
                    ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Code className="h-4 w-4" />
                <span>개발자</span>
              </button>
            </div>
          </div>

          {/* Bottom Logout */}
          <div className="pt-3 border-t border-line">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs font-bold text-danger transition hover:bg-danger/20"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto relative no-scrollbar pr-14">
          {/* TAB 1: Account (계정 정보 & 보안 & 연결) */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-text">계정</h3>
                <p className="text-xs text-muted mt-1">사용자 계정 정보, 보안 설정 및 외부 서비스 연결을 관리합니다.</p>
              </div>

              {/* Section 1: 계정 정보 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">계정 정보</h4>

                {/* 사용자명 */}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <div>
                    <span className="text-xs text-muted block">사용자명</span>
                    {isEditingUsername ? (
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="mt-1 rounded-lg border border-accent bg-surface-2 px-3 py-1 text-xs font-bold text-text outline-none"
                      />
                    ) : (
                      <span className="text-sm font-bold text-text">{username}</span>
                    )}
                  </div>
                  <button
                    onClick={handleSaveUsername}
                    className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>{isEditingUsername ? "완료" : "수정"}</span>
                  </button>
                </div>

                {/* 이메일 */}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <div>
                    <span className="text-xs text-muted block">이메일</span>
                    {isEditingEmail ? (
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 rounded-lg border border-accent bg-surface-2 px-3 py-1 text-xs font-bold text-text outline-none"
                      />
                    ) : (
                      <span className="text-sm font-bold text-text tracking-wide">
                        {showEmail ? email : email ? "*".repeat(email.length) : "등록되지 않음"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowEmail(!showEmail)}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition"
                    >
                      {showEmail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showEmail ? "숨기기" : "보이기"}</span>
                    </button>
                    <button
                      onClick={handleSaveEmail}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{isEditingEmail ? "완료" : "수정"}</span>
                    </button>
                  </div>
                </div>

                {/* 전화번호 */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs text-muted block">전화번호</span>
                    {isEditingPhone ? (
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1 rounded-lg border border-accent bg-surface-2 px-3 py-1 text-xs font-bold text-text outline-none"
                      />
                    ) : (
                      <span className="text-sm font-bold text-text tracking-wide">
                        {showPhone ? phone : phone ? "*".repeat(phone.length) : "등록되지 않음"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPhone(!showPhone)}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition"
                    >
                      {showPhone ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPhone ? "숨기기" : "보이기"}</span>
                    </button>
                    <button
                      onClick={handleSavePhone}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{isEditingPhone ? "완료" : "수정"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: 비밀번호 및 보안 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">비밀번호 및 보안</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-text block">비밀번호</span>
                    <span className="text-xs text-muted">계정 보안을 위해 정기적으로 비밀번호를 변경하세요.</span>
                  </div>
                  <button
                    onClick={() => setIsEditingPassword(!isEditingPassword)}
                    className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20 transition"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>비밀번호 수정</span>
                  </button>
                </div>

                {isEditingPassword && (
                  <form onSubmit={handlePasswordSubmit} className="mt-3 p-4 rounded-xl border border-line bg-surface-2 space-y-3 animate-fadeIn">
                    {passwordMsg && (
                      <div className="text-xs font-semibold text-accent bg-accent-soft p-2 rounded-lg border border-accent/20">
                        {passwordMsg}
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-semibold text-muted block mb-1">현재 비밀번호</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted block mb-1">새 비밀번호</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingPassword(false)}
                        className="px-3 py-1 text-xs font-medium text-muted hover:text-text"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold text-on-accent bg-accent rounded-lg shadow-sm hover:bg-accent-strong"
                      >
                        저장
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Section 3: 연결 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">연결</h4>
                <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold">
                      G
                    </div>
                    <div>
                      <span className="text-xs font-bold text-text block">Google 계정 연동</span>
                      <span className="text-[11px] text-muted">추후 구글 연동 서비스 제공 예정</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-2 text-muted border border-line">
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
                <h3 className="text-xl font-bold text-text">알림 & 소리</h3>
                <p className="text-xs text-muted mt-1">PC 알림 조건, 소리 모드 및 메시지 수신 효과음을 설정합니다.</p>
              </div>

              {/* 일반 알림 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">일반 알림</h4>

                {/* PC 알림 활성화 */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-sm font-bold text-text block">PC 알림 활성화</span>
                    <span className="text-xs text-muted">컴퓨터 바탕 화면 알림을 표시합니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={pcNotification}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setPcNotification(v);
                      updatePreference({ pcNotification: v });
                    }}
                    className="h-5 w-5 rounded-md border-line bg-accent text-accent focus:ring-accent cursor-pointer"
                  />
                </label>

                <div className="pt-2 border-t border-line space-y-3">
                  <span className="text-[11px] font-bold text-muted block">다음과 같은 경우 알림</span>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-muted">친구와의 우정 기념일을 달성했어요</span>
                    <input
                      type="checkbox"
                      checked={friendAnniversary}
                      onChange={(e) => setFriendAnniversary(e.target.checked)}
                      className="h-4 w-4 rounded border-line bg-accent cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-muted">친구가 온라인일 때</span>
                    <input
                      type="checkbox"
                      checked={friendOnline}
                      onChange={(e) => setFriendOnline(e.target.checked)}
                      className="h-4 w-4 rounded border-line bg-accent cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-muted">친구들의 프로필 업데이트</span>
                    <input
                      type="checkbox"
                      checked={friendProfileUpdate}
                      onChange={(e) => setFriendProfileUpdate(e.target.checked)}
                      className="h-4 w-4 rounded border-line bg-accent cursor-pointer"
                    />
                  </label>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-muted">누군가가 내 메시지에 반응해요</span>
                    <select
                      value={reactionNotification}
                      onChange={(e) => setReactionNotification(e.target.value as "all" | "mentions" | "none")}
                      className="rounded-lg border border-line bg-surface-2 px-3 py-1 text-xs text-text outline-none focus:border-accent"
                    >
                      <option value="all">모든 메시지</option>
                      <option value="mentions">멘션만</option>
                      <option value="none">비활성화</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 소리 알림 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">소리</h4>

                {/* 새로운 메시지 */}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <div>
                    <span className="text-xs font-bold text-text block">새로운 메시지</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent transition"
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
                    className="h-5 w-5 rounded border-line bg-accent cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* 현재 읽고 있는 채널의 신규 메시지 */}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <div>
                    <span className="text-xs font-bold text-text block">현재 읽고 있는 채널의 신규 메시지</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent transition"
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
                    className="h-5 w-5 rounded border-line bg-accent cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* 수신음 */}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <div>
                    <span className="text-xs font-bold text-text block">수신음</span>
                    <button
                      onClick={playTestSound}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent transition"
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
                    className="h-5 w-5 rounded border-line bg-accent cursor-pointer disabled:opacity-30"
                  />
                </div>

                <label className="flex items-start justify-between cursor-pointer pt-2">
                  <div className="pr-4">
                    <span className="text-xs font-bold text-danger block">모든 알림 소리 비활성화</span>
                    <p className="text-[11px] text-muted leading-relaxed mt-0.5">
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
                    className="h-5 w-5 shrink-0 rounded border-line bg-danger cursor-pointer mt-1"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Voice & Video (음성 및 비디오) */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-text">음성 및 비디오</h3>
                <p className="text-xs text-muted mt-1">마이크/스피커 선택, 음량, 마이크 테스트, 입력 프로필 및 카메라를 설정합니다.</p>
              </div>

              {/* 음성 설정 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">음성</h4>

                {/* 마이크 & 스피커 드롭다운 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1.5">마이크</label>
                    <select
                      value={selectedMic}
                      onChange={(e) => setSelectedMic(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-accent"
                    >
                      <option value="">MacBook Pro 마이크</option>
                      {audioInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `마이크 (${d.deviceId.slice(0, 6)})`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1.5">스피커</label>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-accent"
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
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>마이크 음량</span>
                      <span>{micVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={micVolume}
                      onChange={(e) => setMicVolume(Number(e.target.value))}
                      className="w-full accent-accent cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>스피커 음량</span>
                      <span>{speakerVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={speakerVolume}
                      onChange={(e) => setSpeakerVolume(Number(e.target.value))}
                      className="w-full accent-accent cursor-pointer"
                    />
                  </div>
                </div>

                {/* 마이크 테스트 & 레벨 메터 */}
                <div className="p-4 rounded-xl border border-line bg-surface-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-text block">마이크 테스트</span>
                      <span className="text-[11px] text-muted">마이크에 말을 하여 입력 음량을 확인하고 스피커/헤드폰으로 내 목소리를 직접 들어보세요.</span>
                    </div>
                    <button
                      onClick={() => setIsTestingMic(!isTestingMic)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                        isTestingMic
                          ? "bg-danger text-on-accent shadow-md"
                          : "bg-accent hover:bg-accent-strong text-on-accent"
                      }`}
                    >
                      {isTestingMic ? "테스트 중지" : "마이크 테스트"}
                    </button>
                  </div>

                  {/* Meter Bar */}
                  <div className="h-3 w-full bg-surface-2 rounded-full overflow-hidden p-0.5 border border-line">
                    <div
                      className="h-full bg-gradient-to-r from-online via-accent to-accent-strong rounded-full transition-all duration-150"
                      style={{ width: `${micMeterLevel}%` }}
                    />
                  </div>

                  {/* Audio Loopback Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-line">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3.5 w-3.5 text-accent" />
                      <span className="text-xs font-semibold text-muted">내 목소리 직접 듣기 (오디오 루프백)</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={micLoopback}
                        onChange={(e) => setMicLoopback(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>도움이 필요하신가요? 문제 해결 가이드를 확인하세요.</span>
                  <a href="#help" className="text-accent hover:underline flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    <span>가이드</span>
                  </a>
                </div>

                {/* 입력 프로필 */}
                <div className="pt-3 border-t border-line space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-muted block">입력 프로필</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setInputProfile("isolation")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "isolation"
                          ? "border-accent bg-accent-soft text-text"
                          : "border-line bg-surface text-muted hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                        <span>음성 격리</span>
                      </div>
                      <p className="text-[10px] text-muted leading-tight">
                        멋진 목소리만 들려 드릴게요. 소음은 알아서 처리할게요
                      </p>
                    </button>

                    <button
                      onClick={() => setInputProfile("studio")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "studio"
                          ? "border-accent bg-accent-soft text-text"
                          : "border-line bg-surface text-muted hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Volume2 className="h-3.5 w-3.5 text-accent-strong" />
                        <span>스튜디오</span>
                      </div>
                      <p className="text-[10px] text-muted leading-tight">
                        순수 오디오: 프로세싱 없이 마이크 열기
                      </p>
                    </button>

                    <button
                      onClick={() => setInputProfile("custom")}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        inputProfile === "custom"
                          ? "border-accent bg-accent-soft text-text"
                          : "border-line bg-surface text-muted hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        <Sliders className="h-3.5 w-3.5 text-online" />
                        <span>사용자 지정</span>
                      </div>
                      <p className="text-[10px] text-muted leading-tight">
                        고급 모드: 모든 버튼과 다이얼을 주세요!
                      </p>
                    </button>
                  </div>
                </div>

                {/* 눌러서 말하기 (Push-to-Talk) */}
                <label className="flex items-center justify-between cursor-pointer pt-2">
                  <span className="text-xs font-bold text-text">눌러서 말하기 (Push-to-Talk)</span>
                  <input
                    type="checkbox"
                    checked={pushToTalk}
                    onChange={(e) => setPushToTalk(e.target.checked)}
                    className="h-5 w-5 rounded border-line bg-accent cursor-pointer"
                  />
                </label>
              </div>

              {/* 카메라 설정 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">카메라</h4>

                {/* 영상 테스트 Viewport */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-line bg-surface-2 min-h-[160px] relative overflow-hidden">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 h-full w-full object-cover ${isTestingVideo ? "block" : "hidden"}`}
                  />
                  {!isTestingVideo && (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Video className="h-8 w-8 text-muted stroke-1" />
                      <span className="text-xs text-muted">카메라를 켜서 영상 상태를 확인하세요.</span>
                    </div>
                  )}
                  <button
                    onClick={() => setIsTestingVideo(!isTestingVideo)}
                    className="mt-3 z-10 px-4 py-1.5 rounded-lg text-xs font-bold text-on-accent bg-accent hover:bg-accent-strong shadow-md transition"
                  >
                    {isTestingVideo ? "영상 중지" : "[영상 테스트]"}
                  </button>
                </div>

                {/* 영상 항상 미리 보기 */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-xs font-bold text-text block">영상 항상 미리 보기</span>
                    <span className="text-[11px] text-muted">영상을 켤 때마다 미리 보기 모달 띄우기</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={alwaysPreviewVideo}
                    onChange={(e) => setAlwaysPreviewVideo(e.target.checked)}
                    className="h-5 w-5 rounded border-line bg-accent cursor-pointer"
                  />
                </label>

                {/* 카메라 선택 */}
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1.5">카메라 장치</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-accent"
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
                <h3 className="text-xl font-bold text-text">언어 및 시간</h3>
                <p className="text-xs text-muted mt-1">표시 언어와 시간 형식을 선택합니다.</p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">언어 선택하기</h4>
                <p className="text-xs text-muted">Omni Platform에 표시할 언어를 선택하세요.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => changeLocale("ko")}
                    className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold transition ${
                      locale === "ko"
                        ? "border-accent bg-accent-soft text-text shadow-md"
                        : "border-line bg-surface text-muted hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🇰🇷</span>
                      <span>한국어</span>
                    </div>
                    {locale === "ko" && <Check className="h-4 w-4 text-accent" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => changeLocale("en")}
                    className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold transition ${
                      locale === "en"
                        ? "border-accent bg-accent-soft text-text shadow-md"
                        : "border-line bg-surface text-muted hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🇺🇸</span>
                      <span>English</span>
                    </div>
                    {locale === "en" && <Check className="h-4 w-4 text-accent" />}
                  </button>
                </div>
              </div>

              {/* 시간 형식 */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">시간 형식</h4>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-2 cursor-pointer hover:bg-surface-2 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="auto"
                      checked={timeFormat === "auto"}
                      onChange={() => {
                        setTimeFormat("auto");
                        updatePreference({ timeFormat: "auto" });
                      }}
                      className="h-4 w-4 text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-semibold text-text">자동 (시스템 기본값)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-2 cursor-pointer hover:bg-surface-2 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="12h"
                      checked={timeFormat === "12h"}
                      onChange={() => {
                        setTimeFormat("12h");
                        updatePreference({ timeFormat: "12h" });
                      }}
                      className="h-4 w-4 text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-semibold text-text">12시간 (오후 2:30)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-2 cursor-pointer hover:bg-surface-2 transition">
                    <input
                      type="radio"
                      name="timeFormat"
                      value="24h"
                      checked={timeFormat === "24h"}
                      onChange={() => {
                        setTimeFormat("24h");
                        updatePreference({ timeFormat: "24h" });
                      }}
                      className="h-4 w-4 text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-semibold text-text">24시간 (14:30)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Appearance (테마) */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-text">테마</h3>
                <p className="text-xs text-muted mt-1">앱의 색상과 분위기를 선택하세요.</p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">색상 테마</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: "default" as const, label: "Default", desc: "오리지널 Omni 룩", bg: "#09090b", surface: "#0c0c0e", accent: "#4f46e5" },
                      { key: "transmission" as const, label: "Transmission", desc: "신호와 정적", bg: "#12141a", surface: "#1a1d26", accent: "#ff9d3f" },
                      { key: "night-signal" as const, label: "Night Signal", desc: "네온 나이트라이프", bg: "#1b1024", surface: "#241531", accent: "#ff4f7b" },
                    ]
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setThemeNameLocal(t.key);
                        onThemeChange(t.key, themeModeLocal);
                        updatePreference({ themeName: t.key });
                      }}
                      className={`text-left rounded-xl border p-3 transition ${
                        themeNameLocal === t.key
                          ? "border-accent bg-accent-soft"
                          : "border-line bg-surface-2 hover:bg-surface-2/70"
                      }`}
                    >
                      <div className="flex gap-1.5 mb-2">
                        <span className="h-6 w-6 rounded-md" style={{ background: t.bg }} />
                        <span className="h-6 w-6 rounded-md" style={{ background: t.surface }} />
                        <span className="h-6 w-6 rounded-md" style={{ background: t.accent }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text">{t.label}</span>
                        {themeNameLocal === t.key && <Check className="h-4 w-4 text-accent" />}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">화면 모드</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "dark" as const, label: "다크" },
                      { key: "light" as const, label: "라이트" },
                    ]
                  ).map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-2 cursor-pointer hover:bg-surface-2/70 transition"
                    >
                      <input
                        type="radio"
                        name="themeMode"
                        value={m.key}
                        checked={themeModeLocal === m.key}
                        onChange={() => {
                          setThemeModeLocal(m.key);
                          onThemeChange(themeNameLocal, m.key);
                          updatePreference({ themeMode: m.key });
                        }}
                        className="h-4 w-4 text-accent focus:ring-accent"
                      />
                      <span className="text-xs font-semibold text-text">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Developer (개발자 정보) */}
          {activeTab === "developer" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-text">개발자</h3>
                <p className="text-xs text-muted mt-1">플랫폼 엔진 및 빌드 정보를 확인합니다.</p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">개발자 정보</h4>
                
                <div className="space-y-2 text-xs font-mono text-muted">
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">App Name</span>
                    <span className="font-bold text-text">Omni Platform</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Version</span>
                    <span className="font-bold text-text">0.1.0-release</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Author</span>
                    <span className="font-bold text-text">Lee Junhwan (SteadyToVivid)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Engine</span>
                    <span className="font-bold text-accent">Next.js 15 + LiveKit + Supabase</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted">Environment</span>
                    <span className="font-bold text-online">Production Mode</span>
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
