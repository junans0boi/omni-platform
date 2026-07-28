"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
} from "livekit-client";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import { currentDocumentVisibility, shouldRenderVideo } from "@/lib/media-visibility";
import {
  DEFAULT_PARTICIPANT_VOLUME,
  clampParticipantVolume,
  readParticipantVolumes,
  writeParticipantVolumes,
} from "@/lib/participant-volume";
import {
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  ChevronUp, ChevronDown, Volume2, Maximize2, Minimize2,
  Hand, Users, Captions,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #102 & TICK-201: DataChannel 발언권 및 실시간 자막 메시지 프로토콜
// ─────────────────────────────────────────────────────────────────────────────
type FloorMsgType = "FLOOR_REQUEST" | "FLOOR_CANCEL" | "FLOOR_GRANT" | "FLOOR_REVOKE" | "CAPTION_CHUNK";

interface FloorMessage {
  type: FloorMsgType;
  /** 요청자/대상자의 participant.identity */
  identity: string;
  /** 표시 이름 (REQUEST 시 함께 전달) */
  name?: string;
  /** 자막 텍스트 (CAPTION_CHUNK 시) */
  captionText?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function encodeFloor(msg: FloorMessage): Uint8Array<ArrayBuffer> {
  return enc.encode(JSON.stringify(msg)) as Uint8Array<ArrayBuffer>;
}

function decodeFloor(data: Uint8Array): FloorMessage | null {
  try {
    return JSON.parse(dec.decode(data)) as FloorMessage;
  } catch {
    return null;
  }
}

export default function VoiceGrid() {
  const { t } = useI18n();
  const {
    livekitToken,
    activeVoiceChannelId,
    isMuted,
    isCameraOn,
    isScreenSharing,
    leaveVoiceChannel,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    profile,
    channels,
  } = useAppStore(useShallow((state) => ({
    livekitToken: state.livekitToken,
    activeVoiceChannelId: state.activeVoiceChannelId,
    isMuted: state.isMuted,
    isCameraOn: state.isCameraOn,
    isScreenSharing: state.isScreenSharing,
    leaveVoiceChannel: state.leaveVoiceChannel,
    toggleMute: state.toggleMute,
    toggleCamera: state.toggleCamera,
    toggleScreenShare: state.toggleScreenShare,
    profile: state.profile,
    channels: state.channels,
  })));

  const { spaces, activeSpaceId, members } = useAppStore(
    useShallow((state) => ({
      spaces: state.spaces,
      activeSpaceId: state.activeSpaceId,
      members: state.members,
    }))
  );

  const activeChannel = channels.find((c) => c.id === activeVoiceChannelId);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const currentMember = members.find((m) => m.profileId === profile?.id && m.spaceId === activeSpaceId);
  const isHost = Boolean(
    activeSpace?.ownerId === profile?.id ||
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN"
  );

  const channelMode = activeChannel?.mode ?? "GENERAL";
  const isStructuredMode = channelMode === "MEETING" || channelMode === "LECTURE";

  // ── State ──────────────────────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // TICK-301, TICK-302: 실시간 AI 자막 롤링 State (최근 3개 화자 대화 롤링)
  const [showCaptions, setShowCaptions] = useState(true);
  const [captionsList, setCaptionsList] = useState<{ id: string; speaker: string; text: string }[]>([]);

  // 디스코드 스타일 카메라/화면공유 드롭다운 메뉴 팝오버
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showScreenMenu, setShowScreenMenu] = useState(false);
  const [cameraBg, setCameraBg] = useState<"none" | "blur" | "office" | "cafe">("none");
  const [screenPreset, setScreenPreset] = useState<"720p" | "1080p60">("1080p60");

  // Issue #102: 발언권 — DataChannel 연동
  const [floorRequests, setFloorRequests] = useState<{ identity: string; name: string }[]>([]);
  const [grantedSpeakers, setGrantedSpeakers] = useState<string[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  /** 내 발언이 허용/거부됐을 때 표시할 토스트 메시지 */
  const [floorToast, setFloorToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [showFloorPanel, setShowFloorPanel] = useState(false);

  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [localParticipantSid, setLocalParticipantSid] = useState("");
  const [localMedia, setLocalMedia] = useState({ revision: 0, hasScreenShare: false });
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [participantVolumeOverride, setParticipantVolumeOverride] = useState<{
    profileId: string;
    values: Record<string, number>;
  } | null>(null);
  const [documentVisibility, setDocumentVisibility] =
    useState<DocumentVisibilityState>(currentDocumentVisibility);

  const roomRef = useRef<Room | null>(null);
  const muteInitializedRef = useRef(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const canPublish = getCanPublish(livekitToken);
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const renderVideo = shouldRenderVideo(isCollapsed, documentVisibility);
  // ── 토스트 자동 소멸 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!floorToast) return;
    const timer = setTimeout(() => setFloorToast(null), 4000);
    return () => clearTimeout(timer);
  }, [floorToast]);

  const storedParticipantVolumes = useMemo(
    () => profile && typeof window !== "undefined"
      ? readParticipantVolumes(profile.id, window.localStorage)
      : {},
    [profile],
  );
  const participantVolumes = profile && participantVolumeOverride?.profileId === profile.id
    ? participantVolumeOverride.values
    : storedParticipantVolumes;

  const setParticipantVolume = (participantId: string, value: number) => {
    if (!profile || typeof window === "undefined") return;
    const next = { ...participantVolumes, [participantId]: clampParticipantVolume(value) };
    setParticipantVolumeOverride({ profileId: profile.id, values: next });
    try {
      writeParticipantVolumes(profile.id, next, window.localStorage);
    } catch { /* localStorage unavailable */ }
  };

  useEffect(() => {
    const syncVisibility = () => setDocumentVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  // ── DataChannel 메시지 발행 헬퍼 ─────────────────────────────────────────
  const publishFloor = useCallback((msg: FloorMessage) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.publishData(encodeFloor(msg), {
      reliable: true,
    });
  }, []);

  // Web Speech API 기반 음성 인식 & 자막 전송 훅
  useEffect(() => {
    if (isMuted || !connectionState || connectionState !== ConnectionState.Connected) return;
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ko-KR";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcriptText = event.results[lastIndex][0].transcript;
        if (transcriptText.trim()) {
          const speakerName = profile?.displayName || profile?.username || "나";
          setCaptionsList((prev) => {
            const newItem = { id: `cap_${Date.now()}_${Math.random()}`, speaker: speakerName, text: transcriptText };
            const filtered = prev.filter((item) => item.speaker !== speakerName);
            return [...filtered, newItem].slice(-3);
          });
          publishFloor({
            type: "CAPTION_CHUNK",
            identity: profile?.id || "local",
            name: speakerName,
            captionText: transcriptText,
          });

          // TICK-303: 호스트 자막 회의록 API 저장
          if (activeVoiceChannelId) {
            fetch(`/api/channels/${activeVoiceChannelId}/transcript`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ speaker: speakerName, text: transcriptText }),
            }).catch(() => {});
          }
        }
      };

      recognition.start();
      return () => {
        try { recognition.stop(); } catch {}
      };
    } catch {}
  }, [isMuted, connectionState, profile, publishFloor]);

  // ── DataChannel 수신 처리 ─────────────────────────────────────────────

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!livekitToken || !activeVoiceChannelId) return;
    if (!wsUrl) {
      console.error("NEXT_PUBLIC_LIVEKIT_URL is not set in .env.local");
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let disposed = false;

    const syncParticipants = () =>
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));

    room.on(RoomEvent.ParticipantConnected, () => {
      syncParticipants();
      getSoundEffects()?.emit("REMOTE_JOINED");
    });
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      syncParticipants();
      getSoundEffects()?.emit("REMOTE_LEFT");
      // 나간 참여자의 발언 신청 정리
      setFloorRequests((prev) => prev.filter((r) => r.identity !== p.identity));
      setGrantedSpeakers((prev) => prev.filter((i) => i !== p.identity));
    });
    room.on(RoomEvent.TrackSubscribed, syncParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    room.on(RoomEvent.TrackMuted, syncParticipants);
    room.on(RoomEvent.TrackUnmuted, syncParticipants);
    room.on(RoomEvent.ConnectionStateChanged, setConnectionState);

    const syncLocalMedia = () => {
      const hasScreenShare = Array.from(
        room.localParticipant.trackPublications.values()
      ).some((p) => p.source === Track.Source.ScreenShare && !p.isMuted);
      setLocalMedia((m) => ({ revision: m.revision + 1, hasScreenShare }));
    };
    room.on(RoomEvent.LocalTrackPublished, syncLocalMedia);
    room.on(RoomEvent.LocalTrackUnpublished, syncLocalMedia);
    room.on(RoomEvent.AudioPlaybackStatusChanged, () =>
      setAudioBlocked(!room.canPlaybackAudio)
    );
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
      setActiveSpeakerSids(speakers.map((s) => s.sid))
    );
    room.on(RoomEvent.Disconnected, () => {
      setRemoteParticipants([]);
      setLocalParticipantSid("");
      setFloorRequests([]);
      setGrantedSpeakers([]);
    });

    // ── Issue #102: DataChannel 수신 핸들러 ─────────────────────────────────
    room.on(
      RoomEvent.DataReceived,
      (payload: Uint8Array<ArrayBuffer>, _participant, _kind) => {
        const msg = decodeFloor(payload);
        if (!msg) return;
        const myIdentity = room.localParticipant.identity;

        switch (msg.type) {
          // ─── 비-호스트가 발언 신청 브로드캐스트 → 호스트 목록에 추가 ───
          case "FLOOR_REQUEST":
            setFloorRequests((prev) => {
              if (prev.some((r) => r.identity === msg.identity)) return prev;
              return [...prev, { identity: msg.identity, name: msg.name ?? msg.identity }];
            });
            break;

          // ─── 비-호스트가 신청 취소 → 목록에서 제거 ──────────────────────
          case "FLOOR_CANCEL":
            setFloorRequests((prev) => prev.filter((r) => r.identity !== msg.identity));
            setGrantedSpeakers((prev) => prev.filter((i) => i !== msg.identity));
            break;

          // ─── 호스트가 발언 허용 → 본인이면 마이크 켜기 + 토스트 ─────────
          case "FLOOR_GRANT":
            setGrantedSpeakers((prev) =>
              prev.includes(msg.identity) ? prev : [...prev, msg.identity]
            );
            if (msg.identity === myIdentity) {
              // 내 마이크를 unmute (canPublish 여부와 무관하게 직접 활성화)
              room.localParticipant.setMicrophoneEnabled(true).catch((e) =>
                console.warn("Floor grant mic error:", e.message)
              );
              setHandRaised(false);
              setFloorToast({ text: "발언이 허용되었습니다. 마이크가 켜졌습니다.", ok: true });
            }
            break;

          // ─── 호스트가 발언 회수 → 본인이면 마이크 끄기 + 토스트 ─────────
          case "FLOOR_REVOKE":
            setGrantedSpeakers((prev) => prev.filter((i) => i !== msg.identity));
            setFloorRequests((prev) => prev.filter((r) => r.identity !== msg.identity));
            if (msg.identity === myIdentity) {
              room.localParticipant.setMicrophoneEnabled(false).catch((e) =>
                console.warn("Floor revoke mic error:", e.message)
              );
              setHandRaised(false);
              setFloorToast({ text: "발언 권한이 회수되었습니다.", ok: false });
            }
            break;

          // ─── TICK-301: 실시간 AI 자막 패킷 수신 ──────────────────────
          case "CAPTION_CHUNK":
            if (msg.captionText) {
              const speakerName = msg.name || msg.identity;
              setCaptionsList((prev) => {
                const newItem = { id: `cap_${Date.now()}_${Math.random()}`, speaker: speakerName, text: msg.captionText! };
                const filtered = prev.filter((item) => item.speaker !== speakerName);
                return [...filtered, newItem].slice(-3);
              });
            }
            break;
        }
      }
    );

    const connect = async () => {
      setConnectionError(null);
      setAudioBlocked(false);
      try {
        await room.connect(wsUrl, livekitToken);
        if (disposed) { await room.disconnect(); return; }
        setLocalParticipantSid(room.localParticipant.sid);
        setAudioBlocked(!room.canPlaybackAudio);
        syncParticipants();
        getSoundEffects()?.emit("LOCAL_CONNECTED");
      } catch (error: unknown) {
        if (disposed) return;
        console.error("LiveKit connection error:", error);
        setConnectionError(getErrorMessage(error));
        setConnectionState(ConnectionState.Disconnected);
      }
    };
    connect();

    return () => {
      disposed = true;
      if (room.state === ConnectionState.Connected)
        getSoundEffects()?.emit("LOCAL_DISCONNECTED");
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      muteInitializedRef.current = false;
    };
  }, [livekitToken, activeVoiceChannelId, wsUrl]);

  const screenShareInitRef = useRef(false);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setMicrophoneEnabled(!isMuted).then(() => {
      if (muteInitializedRef.current)
        getSoundEffects()?.emit(isMuted ? "LOCAL_MUTED" : "LOCAL_UNMUTED");
      muteInitializedRef.current = true;
    }).catch((e) => console.warn("Mic toggle error:", e.message));
  }, [canPublish, connectionState, isMuted]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setCameraEnabled(isCameraOn)
      .catch((e) => console.warn("Camera toggle error:", e.message));
  }, [canPublish, connectionState, isCameraOn]);

  // ── Screen share toggle ───────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setScreenShareEnabled(isScreenSharing).then(() => {
      if (screenShareInitRef.current)
        getSoundEffects()?.emit(isScreenSharing ? "SCREEN_SHARE_STARTED" : "SCREEN_SHARE_STOPPED");
      screenShareInitRef.current = true;
    }).catch((e) => console.warn("Screen share error:", e.message));
  }, [canPublish, connectionState, isScreenSharing]);

  // ── Attach local video track ──────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    const container = localVideoRef.current;
    if (!room || !container || !renderVideo) return;

    const publications = Array.from(room.localParticipant.trackPublications.values())
      .filter((p) => p.track?.kind === Track.Kind.Video);
    const screenShare = publications.find((p) => p.source === Track.Source.ScreenShare);
    const visible = screenShare
      ? [screenShare]
      : publications.filter((p) => p.source === Track.Source.Camera);

    const attached = visible.flatMap((pub) => {
      if (!pub.track) return [];
      const el = pub.track.attach();
      el.className = `absolute inset-0 h-full w-full rounded-lg object-cover ${
        pub.source === Track.Source.Camera ? "scale-x-[-1]" : ""
      }`;
      container.appendChild(el);
      return [{ track: pub.track, element: el }];
    });

    return () => attached.forEach(({ track, element }) => {
      track.detach(element);
      element.remove();
    });
  }, [activeVoiceChannelId, livekitToken, localMedia.revision, renderVideo]);

  // ── Remote audio (always attached even when collapsed) ───────────────────
  useEffect(() => {
    const attached = remoteParticipants.flatMap((p) => {
      const container = remoteVideoRefs.current[p.sid];
      if (!container) return [];
      return Array.from(p.trackPublications.values()).flatMap((pub) => {
        if (!pub.track || !pub.isSubscribed || pub.track.kind !== Track.Kind.Audio) return [];
        const el = pub.track.attach();
        el.volume = (participantVolumes[p.identity] ?? DEFAULT_PARTICIPANT_VOLUME) / 100;
        container.appendChild(el);
        return [{ track: pub.track, element: el }];
      });
    });
    return () => attached.forEach(({ track, element }) => {
      track.detach(element);
      element.remove();
    });
  }, [participantVolumes, remoteParticipants]);

  // ── Remote video ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!renderVideo) return;
    const attached = remoteParticipants.flatMap((participant) => {
      const container = remoteVideoRefs.current[participant.sid];
      if (!container) return [];
      const pubs = Array.from(participant.trackPublications.values());
      const screenShare = pubs.find(
        (p) => p.source === Track.Source.ScreenShare && p.track?.kind === Track.Kind.Video && !p.isMuted && p.isSubscribed
      );
      const visible = screenShare || pubs.find(
        (p) => p.source === Track.Source.Camera && p.track?.kind === Track.Kind.Video && !p.isMuted && p.isSubscribed
      );
      if (!visible?.track) return [];
      const el = visible.track.attach();
      el.className = "absolute inset-0 h-full w-full rounded-lg object-cover";
      container.appendChild(el);
      return [{ track: visible.track, element: el }];
    });
    return () => attached.forEach(({ track, element }) => {
      track.detach(element);
      element.remove();
    });
  }, [remoteParticipants, renderVideo]);

  if (!activeVoiceChannelId || !livekitToken) return null;

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  const connectionLabel = isConnected
    ? t("voice.status.connected")
    : isConnecting
      ? t("voice.status.connecting")
      : connectionState === ConnectionState.Reconnecting ||
          connectionState === ConnectionState.SignalReconnecting
        ? t("voice.status.reconnecting")
        : t("voice.status.disconnected");

  const hasLocalScreenShare = isConnected && localMedia.hasScreenShare;
  const isEffectivelyMuted = !canPublish || isMuted;
  const visibleConnectionError = connectionError ||
    (!wsUrl ? "LiveKit URL이 설정되지 않았습니다." : null);

  const modeLabel = channelMode === "LECTURE"
    ? t("voice.mode.lecture")
    : channelMode === "MEETING"
      ? t("voice.mode.meeting")
      : t("voice.mode.general");

  const modeIcon = channelMode === "LECTURE" ? "🎓" : channelMode === "MEETING" ? "🤝" : "💬";

  // ── 손들기 핸들러 (DataChannel 브로드캐스트) ──────────────────────────────
  const handleRaiseHand = () => {
    if (!profile) return;
    const myIdentity = roomRef.current?.localParticipant.identity ?? profile.id;
    const nextState = !handRaised;
    setHandRaised(nextState);
    if (nextState) {
      publishFloor({
        type: "FLOOR_REQUEST",
        identity: myIdentity,
        name: profile.displayName || profile.username,
      });
      // 내 발언 신청 목록에도 추가 (호스트 본인이 직접 보려는 경우 대비)
      setFloorRequests((prev) => {
        if (prev.some((r) => r.identity === myIdentity)) return prev;
        return [...prev, { identity: myIdentity, name: profile.displayName || profile.username }];
      });
    } else {
      publishFloor({ type: "FLOOR_CANCEL", identity: myIdentity });
      setFloorRequests((prev) => prev.filter((r) => r.identity !== myIdentity));
      setGrantedSpeakers((prev) => prev.filter((i) => i !== myIdentity));
    }
  };

  // ── 발언 허용 핸들러 (호스트 전용) ──────────────────────────────────────
  const handleGrant = (identity: string) => {
    setGrantedSpeakers((prev) => prev.includes(identity) ? prev : [...prev, identity]);
    publishFloor({ type: "FLOOR_GRANT", identity });
  };

  // ── 발언 회수 핸들러 (호스트 전용) ──────────────────────────────────────
  const handleRevoke = (identity: string) => {
    setGrantedSpeakers((prev) => prev.filter((i) => i !== identity));
    setFloorRequests((prev) => prev.filter((r) => r.identity !== identity));
    publishFloor({ type: "FLOOR_REVOKE", identity });
  };

  const myIdentity = roomRef.current?.localParticipant.identity ?? "";
  const iAmGranted = grantedSpeakers.includes(myIdentity);

  return (
    <div
      className="border-b border-line bg-black/40 backdrop-blur-md"
      data-livekit-video-rendering={renderVideo ? "active" : "paused"}
    >
      {/* ── Floor Toast Notification ─────────────────────────────────────── */}
      {floorToast && (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b ${
            floorToast.ok
              ? "bg-online/10 border-online/20 text-online"
              : "bg-danger/10 border-danger/20 text-danger"
          } animate-in slide-in-from-top-2 duration-200`}
        >
          {floorToast.ok ? "✅" : "🚫"}
          {floorToast.text}
          <button
            onClick={() => setFloorToast(null)}
            className="ml-auto text-inherit opacity-70 hover:opacity-100"
          >✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <span className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse bg-online" : "bg-idle"}`} />
          {connectionLabel}
          {visibleConnectionError && (
            <span className="ml-2 text-danger">— {visibleConnectionError}</span>
          )}
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-surface hover:text-text"
        >
          {isCollapsed
            ? <><span>{t("voice.control.show")}</span><ChevronDown className="h-3 w-3" /></>
            : <><span>{t("voice.control.hide")}</span><ChevronUp className="h-3 w-3" /></>
          }
        </button>
      </div>

      {/* Grid */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
        isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}>
        <div className="overflow-hidden">
          {audioBlocked && (
            <div className="flex justify-center px-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const room = roomRef.current;
                  if (!room) return;
                  try {
                    await room.startAudio();
                    setAudioBlocked(!room.canPlaybackAudio);
                  } catch (error) {
                    setConnectionError(getErrorMessage(error));
                  }
                }}
                className="rounded-full bg-idle/15 px-3 py-1 text-xs font-semibold text-idle hover:bg-idle/25"
              >
                {t("voice.control.startAudio")}
              </button>
            </div>
          )}

          {/* Participant Grid */}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
            {/* Local tile */}
            <div className={`relative aspect-video overflow-hidden rounded-xl border bg-surface ${
              hasLocalScreenShare ? "col-span-2" : ""
            } ${
              activeSpeakerSids.includes(localParticipantSid)
                ? "border-online shadow-md shadow-online/20"
                : "border-line"
            }`}>
              <div ref={localVideoRef} className="h-full w-full flex items-center justify-center">
                {!isCameraOn && !hasLocalScreenShare && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-text">
                      {t("voice.floor.me")}
                    </div>
                    {/* 발언 허용됐을 때 글로우 표시 */}
                    {iAmGranted && (
                      <span className="mt-1 text-[9px] font-bold text-online animate-pulse">
                        {t("voice.floor.granted")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-text backdrop-blur-xs">
                {isEffectivelyMuted && <MicOff className="h-2.5 w-2.5 text-danger" />}
                {t("voice.floor.me")}
                {iAmGranted && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-online animate-pulse" />}
              </div>
            </div>

            {/* Remote tiles */}
            {remoteParticipants.map((p) => {
              const isSpeaking = activeSpeakerSids.includes(p.sid);
              const hasVideo = Array.from(p.trackPublications.values()).some(
                (pub) => pub.track?.kind === Track.Kind.Video && !pub.isMuted && pub.isSubscribed
              );
              const isMutedRemote = Array.from(p.trackPublications.values()).some(
                (pub) => pub.track?.kind === Track.Kind.Audio && pub.isMuted
              );
              const hasAudio = Array.from(p.trackPublications.values()).some(
                (pub) => pub.track?.kind === Track.Kind.Audio && pub.isSubscribed && !pub.isMuted
              );
              const hasScreenShare = Array.from(p.trackPublications.values()).some(
                (pub) => pub.source === Track.Source.ScreenShare && !pub.isMuted && pub.isSubscribed
              );
              // 이 참여자가 발언 허용된 상태인지
              const pIsGranted = grantedSpeakers.includes(p.identity);
              // 이 참여자가 발언 신청 중인지
              const pHandRaised = floorRequests.some((r) => r.identity === p.identity);

              return (
                <div
                  key={p.sid}
                  data-livekit-participant={p.identity}
                  data-livekit-audio-subscribed={hasAudio}
                  data-livekit-video-source={hasScreenShare ? "screen_share" : hasVideo ? "camera" : "none"}
                  className={`relative aspect-video overflow-hidden rounded-xl border bg-surface ${
                    hasScreenShare ? "col-span-2" : ""
                  } ${isSpeaking ? "border-online shadow-md shadow-online/20" : "border-line"}`}
                >
                  <div
                    ref={(el) => {
                      if (el) remoteVideoRefs.current[p.sid] = el;
                      else delete remoteVideoRefs.current[p.sid];
                    }}
                    className="h-full w-full flex items-center justify-center"
                  >
                    {!hasVideo && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-text">
                        {p.identity.substring(0, 2)}
                      </div>
                    )}
                  </div>

                  {/* 발언 신청 중 표시 — 손 아이콘 */}
                  {pHandRaised && !pIsGranted && (
                    <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-idle/80 text-[11px] animate-bounce" title="발언 신청 중">
                      ✋
                    </div>
                  )}
                  {/* 발언 허용됨 표시 */}
                  {pIsGranted && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-online/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      <Mic className="h-2.5 w-2.5" />
                      {t("voice.floor.granted")}
                    </div>
                  )}

                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-text backdrop-blur-xs">
                    {isMutedRemote && <MicOff className="h-2.5 w-2.5 text-danger" />}
                    {p.name || p.identity}
                  </div>
                  <label className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-text">
                    <span className="sr-only">{p.name || p.identity} volume</span>
                    <Volume2 className="h-2.5 w-2.5" aria-hidden="true" />
                    <input
                      type="range" min="0" max="100"
                      value={participantVolumes[p.identity] ?? DEFAULT_PARTICIPANT_VOLUME}
                      aria-label={`${p.name || p.identity} volume`}
                      onChange={(e) => setParticipantVolume(p.identity, Number(e.target.value))}
                      className="w-16"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {/* TICK-302: Live Captions Rolling List Overlay */}
          {showCaptions && captionsList.length > 0 && (
            <div className="mx-3 mb-2 flex flex-col items-center justify-center space-y-1.5 animate-in slide-in-from-bottom-2 duration-200">
              {captionsList.map((cap) => (
                <div key={cap.id} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-surface/90 px-4 py-1.5 shadow-lg backdrop-blur-md text-xs max-w-xl">
                  <span className="font-bold text-accent shrink-0">💬 @{cap.speaker}:</span>
                  <span className="text-text font-medium truncate">{cap.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2.5 border-t border-line flex-wrap px-3">
            {/* Mic */}
            <ControlButton
              active={!isEffectivelyMuted}
              activeClass="bg-surface text-muted border-line hover:bg-surface-2"
              inactiveClass="bg-danger/10 text-danger border-danger/20"
              onClick={toggleMute}
              title={canPublish
                ? (isMuted ? t("voice.control.unmute") : t("voice.control.mute"))
                : t("voice.error.noStagePublish")}
              ariaPressed={isMuted}
              disabled={!canPublish || !isConnected}
            >
              {isEffectivelyMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </ControlButton>

            {/* Camera with Discord-style Dropdown Menu (> / Chevron) */}
            <div className="relative flex items-center">
              <ControlButton
                active={isCameraOn}
                activeClass="bg-surface text-muted border-line hover:bg-surface-2"
                inactiveClass="bg-danger/10 text-danger border-danger/20"
                onClick={toggleCamera}
                title={canPublish
                  ? (isCameraOn ? t("voice.control.cameraOff") : t("voice.control.cameraOn"))
                  : t("voice.error.noStageCam")}
                ariaPressed={isCameraOn}
                disabled={!canPublish || !isConnected}
              >
                {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </ControlButton>

              {/* 디스코드 스타일 카메라 옵션 화살표(>) 버튼 */}
              <button
                onClick={() => { setShowCameraMenu(!showCameraMenu); setShowScreenMenu(false); }}
                title="웹캠 가상 배경 & 카메라 설정"
                className="flex h-9 w-4 items-center justify-center rounded-r-full text-muted hover:text-text hover:bg-surface-2 -ml-2 border-y border-r border-line text-[10px] transition"
              >
                <ChevronDown className="h-3 w-3" />
              </button>

              {/* 카메라 가상 배경 선택 팝오버 (Discord Virtual Backgrounds) */}
              {showCameraMenu && (
                <div className="absolute bottom-12 left-0 w-64 rounded-2xl border border-line bg-surface p-3 shadow-2xl backdrop-blur-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                    <span className="text-xs font-bold text-text flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5 text-accent" />
                      웹캠 가상 배경 설정
                    </span>
                    <button onClick={() => setShowCameraMenu(false)} className="text-muted hover:text-text text-xs">✕</button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <button
                      onClick={() => { setCameraBg("none"); setShowCameraMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        cameraBg === "none" ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>📷 원본 (효과 없음)</span>
                      {cameraBg === "none" && <span>✓</span>}
                    </button>
                    <button
                      onClick={() => { setCameraBg("blur"); setShowCameraMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        cameraBg === "blur" ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>✨ 배경 블러 (Blur)</span>
                      {cameraBg === "blur" && <span>✓</span>}
                    </button>
                    <button
                      onClick={() => { setCameraBg("office"); setShowCameraMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        cameraBg === "office" ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>🏢 모던 사무실</span>
                      {cameraBg === "office" && <span>✓</span>}
                    </button>
                    <button
                      onClick={() => { setCameraBg("cafe"); setShowCameraMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        cameraBg === "cafe" ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>☕ 아늑한 카페</span>
                      {cameraBg === "cafe" && <span>✓</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Screen share with Dropdown Menu (> / Chevron) */}
            <div className="relative flex items-center">
              <ControlButton
                active={isScreenSharing}
                activeClass="bg-online/10 text-online border-online/20"
                inactiveClass="bg-surface text-muted border-line hover:bg-surface-2"
                onClick={toggleScreenShare}
                title={canPublish ? t("voice.control.shareScreen") : t("voice.error.noStageScreen")}
                ariaPressed={isScreenSharing}
                disabled={!canPublish || !isConnected}
              >
                <Monitor className="h-4 w-4" />
              </ControlButton>

              {/* 디스코드 스타일 화면 공유 옵션 화살표(>) 버튼 */}
              <button
                onClick={() => { setShowScreenMenu(!showScreenMenu); setShowCameraMenu(false); }}
                title="화면 공유 화질 설정"
                className="flex h-9 w-4 items-center justify-center rounded-r-full text-muted hover:text-text hover:bg-surface-2 -ml-2 border-y border-r border-line text-[10px] transition"
              >
                <ChevronDown className="h-3 w-3" />
              </button>

              {/* 화면 공유 화질 선택 팝오버 */}
              {showScreenMenu && (
                <div className="absolute bottom-12 left-0 w-60 rounded-2xl border border-line bg-surface p-3 shadow-2xl backdrop-blur-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                    <span className="text-xs font-bold text-text flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5 text-online" />
                      화면 공유 화질 선택
                    </span>
                    <button onClick={() => setShowScreenMenu(false)} className="text-muted hover:text-text text-xs">✕</button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <button
                      onClick={() => { setScreenPreset("720p"); setShowScreenMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        screenPreset === "720p" ? "bg-online/20 text-online border border-online/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>HD (720p 30fps)</span>
                      {screenPreset === "720p" && <span>✓</span>}
                    </button>
                    <button
                      onClick={() => { setScreenPreset("1080p60"); setShowScreenMenu(false); }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left font-semibold transition ${
                        screenPreset === "1080p60" ? "bg-online/20 text-online border border-online/30" : "hover:bg-surface-2 text-text"
                      }`}
                    >
                      <span>FHD (1080p 60fps) 🔥</span>
                      {screenPreset === "1080p60" && <span>✓</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TICK-202: Live Captions Toggle Button */}
            <ControlButton
              active={showCaptions}
              activeClass="bg-accent/15 text-accent border-accent/30"
              inactiveClass="bg-surface text-muted border-line hover:bg-surface-2"
              onClick={() => setShowCaptions(!showCaptions)}
              title={showCaptions ? "실시간 자막 끄기" : "실시간 자막 켜기"}
              ariaPressed={showCaptions}
            >
              <Captions className="h-4 w-4" />
            </ControlButton>

            {/* Mode Badge */}
            {activeChannel && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface border border-line text-[10px] font-bold text-accent">
                <span>{modeIcon}</span>
                <span>{modeLabel}</span>
                {isHost && <span className="text-amber-400">👑</span>}
              </div>
            )}

            {/* ── MEETING / LECTURE 전용 (GENERAL에서 완전 숨김) ── */}
            {isStructuredMode && (
              <>
                <div className="h-5 w-px bg-surface-2" />

                {/* Raise Hand — 비-호스트 전용 */}
                {!isHost && (
                  <button
                    onClick={handleRaiseHand}
                    title={t("voice.control.raiseHand")}
                    disabled={!isConnected}
                    className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
                      handRaised
                        ? "border-idle/50 bg-idle/20 text-idle shadow-md shadow-idle/20 animate-pulse"
                        : iAmGranted
                          ? "border-online/50 bg-online/20 text-online"
                          : "border-line bg-surface text-muted hover:bg-surface-2"
                    }`}
                  >
                    <Hand className="h-3.5 w-3.5" />
                    <span>
                      {iAmGranted
                        ? t("voice.floor.granted")
                        : handRaised
                          ? t("voice.control.handRaised")
                          : t("voice.control.raiseHand")}
                    </span>
                  </button>
                )}

                {/* Speaker Requests — 호스트 전용 */}
                {isHost && (
                  <div className="relative">
                    <button
                      onClick={() => setShowFloorPanel(!showFloorPanel)}
                      title={t("voice.control.speakerRequests")}
                      className="flex h-9 items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{t("voice.control.speakerRequests")}</span>
                      {floorRequests.length > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-idle text-[10px] font-bold text-slate-950 animate-bounce">
                          {floorRequests.length}
                        </span>
                      )}
                    </button>

                    {/* Floor Panel Dropdown */}
                    {showFloorPanel && (
                      <div className="absolute bottom-12 right-0 w-80 rounded-2xl border border-line bg-surface p-4 shadow-2xl backdrop-blur-2xl z-50 text-left">
                        <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
                          <span className="text-xs font-bold text-text flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-purple-300" />
                            {t("voice.floor.title")}
                            <span className="text-muted font-normal ml-1">
                              — DataChannel 실시간 연동 ✅
                            </span>
                          </span>
                          <button
                            onClick={() => setShowFloorPanel(false)}
                            className="text-muted hover:text-text text-xs"
                          >✕</button>
                        </div>

                        {floorRequests.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted">{t("voice.floor.empty")}</p>
                        ) : (
                          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                            {floorRequests.map((req) => {
                              const isGranted = grantedSpeakers.includes(req.identity);
                              return (
                                <div key={req.identity} className={`flex items-center justify-between rounded-xl p-2.5 text-xs border transition ${
                                  isGranted
                                    ? "bg-online/10 border-online/20"
                                    : "bg-surface border-line"
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold uppercase">
                                      {req.name.substring(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-text truncate max-w-[100px]">{req.name}</p>
                                      <p className="text-[9px] text-muted truncate">{req.identity}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {!isGranted ? (
                                      <button
                                        onClick={() => handleGrant(req.identity)}
                                        className="rounded-lg bg-online px-2.5 py-1 text-[10px] font-bold text-on-accent hover:bg-online/90 transition"
                                      >
                                        {t("voice.floor.allow")}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleRevoke(req.identity)}
                                        className="rounded-lg bg-danger/20 text-danger border border-danger/30 px-2.5 py-1 text-[10px] font-bold hover:bg-danger hover:text-on-accent transition"
                                      >
                                        {t("voice.floor.revoke")}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 일괄 회수 버튼 */}
                        {grantedSpeakers.length > 0 && (
                          <button
                            onClick={() => {
                              grantedSpeakers.forEach((id) => handleRevoke(id));
                            }}
                            className="mt-3 w-full rounded-xl border border-danger/20 bg-danger/10 px-3 py-1.5 text-[11px] font-semibold text-danger hover:bg-danger/20 transition"
                          >
                            발언 권한 전체 회수
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen();
                  setIsFullscreen(false);
                }
              }}
              title={isFullscreen ? t("voice.control.exitFullscreen") : t("voice.control.fullscreen")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:bg-surface-2 transition"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <div className="h-5 w-px bg-surface-2" />

            {/* Leave */}
            <button
              onClick={leaveVoiceChannel}
              className="flex h-9 items-center gap-1.5 rounded-full bg-danger px-4 text-xs font-bold text-on-accent shadow-lg shadow-[0_4px_12px_-2px_var(--danger)] hover:bg-danger/90 active:scale-95"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {t("voice.control.leave")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ControlButton({
  children, onClick, title, active, activeClass, inactiveClass, ariaPressed, disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
  activeClass: string;
  inactiveClass: string;
  ariaPressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={ariaPressed}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${active ? activeClass : inactiveClass}`}
    >
      {children}
    </button>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getCanPublish(token: string | null): boolean {
  if (!token) return false;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const norm = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm.padEnd(Math.ceil(norm.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { video?: { canPublish?: boolean } };
    return payload.video?.canPublish === true;
  } catch { return false; }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "연결 실패";
}
