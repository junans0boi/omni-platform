"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, ChevronUp, ChevronDown } from "lucide-react";

export default function VoiceGrid() {
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
  })));

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [localParticipantSid, setLocalParticipantSid] = useState("");
  const [localMedia, setLocalMedia] = useState({
    revision: 0,
    hasScreenShare: false,
  });
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [documentVisibility, setDocumentVisibility] =
    useState<DocumentVisibilityState>(currentDocumentVisibility);
  const roomRef = useRef<Room | null>(null);
  const muteInitializedRef = useRef(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const canPublish = getCanPublish(livekitToken);
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const renderVideo = shouldRenderVideo(isCollapsed, documentVisibility);

  useEffect(() => {
    const syncVisibility = () => setDocumentVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

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

    // livekit-client v2.x uses remoteParticipants (Map<string, RemoteParticipant>)
    const syncParticipants = () => {
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
    };

    room.on(RoomEvent.ParticipantConnected, () => {
      syncParticipants();
      getSoundEffects()?.emit("REMOTE_JOINED");
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      syncParticipants();
      getSoundEffects()?.emit("REMOTE_LEFT");
    });
    room.on(RoomEvent.TrackSubscribed, syncParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    room.on(RoomEvent.TrackMuted, syncParticipants);
    room.on(RoomEvent.TrackUnmuted, syncParticipants);
    room.on(RoomEvent.ConnectionStateChanged, setConnectionState);
    const syncLocalMedia = () => {
      const hasScreenShare = Array.from(
        room.localParticipant.trackPublications.values()
      ).some(
        (publication) =>
          publication.source === Track.Source.ScreenShare &&
          !publication.isMuted
      );
      setLocalMedia((media) => ({
        revision: media.revision + 1,
        hasScreenShare,
      }));
    };
    room.on(RoomEvent.LocalTrackPublished, syncLocalMedia);
    room.on(RoomEvent.LocalTrackUnpublished, syncLocalMedia);
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setActiveSpeakerSids(speakers.map((s) => s.sid));
    });
    room.on(RoomEvent.Disconnected, () => {
      setRemoteParticipants([]);
      setLocalParticipantSid("");
    });

    const connect = async () => {
      setConnectionError(null);
      setAudioBlocked(false);
      try {
        await room.connect(wsUrl, livekitToken);
        if (disposed) {
          await room.disconnect();
          return;
        }
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
      if (room.state === ConnectionState.Connected) {
        getSoundEffects()?.emit("LOCAL_DISCONNECTED");
      }
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      muteInitializedRef.current = false;
    };
  }, [livekitToken, activeVoiceChannelId, wsUrl]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setMicrophoneEnabled(!isMuted).then(() => {
      if (muteInitializedRef.current) {
        getSoundEffects()?.emit(isMuted ? "LOCAL_MUTED" : "LOCAL_UNMUTED");
      }
      muteInitializedRef.current = true;
    }).catch((e) => console.warn("Mic toggle error:", e.message));
  }, [canPublish, connectionState, isMuted]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setCameraEnabled(isCameraOn).catch((e) =>
      console.warn("Camera toggle error:", e.message)
    );
  }, [canPublish, connectionState, isCameraOn]);

  // ── Screen share toggle ───────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== ConnectionState.Connected || !canPublish) return;
    room.localParticipant.setScreenShareEnabled(isScreenSharing).catch((e) =>
      console.warn("Screen share error:", e.message)
    );
  }, [canPublish, connectionState, isScreenSharing]);

  // ── Attach local video track ──────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    const container = localVideoRef.current;
    if (!room || !container || !renderVideo) return;

    const videoPublications = Array.from(
      room.localParticipant.trackPublications.values()
    ).filter((publication) => publication.track?.kind === Track.Kind.Video);
    const screenShare = videoPublications.find(
      (publication) => publication.source === Track.Source.ScreenShare
    );
    const visiblePublications = screenShare
      ? [screenShare]
      : videoPublications.filter(
          (publication) => publication.source === Track.Source.Camera
        );
    const attachedMedia = visiblePublications
      .flatMap((publication) => {
        if (!publication.track) return [];
        const element = publication.track.attach();
        element.className = `absolute inset-0 h-full w-full rounded-lg object-cover ${
          publication.source === Track.Source.Camera ? "scale-x-[-1]" : ""
        }`;
        container.appendChild(element);
        return [{ track: publication.track, element }];
      });

    return () => {
      attachedMedia.forEach(({ track, element }) => {
        track.detach(element);
        element.remove();
      });
    };
  }, [activeVoiceChannelId, livekitToken, localMedia.revision, renderVideo]);

  // Keep remote audio attached even while the visual grid is collapsed.
  useEffect(() => {
    const attachedMedia = remoteParticipants.flatMap((p) => {
      const container = remoteVideoRefs.current[p.sid];
      if (!container) return [];

      return Array.from(p.trackPublications.values()).flatMap((publication) => {
        if (
          !publication.track ||
          !publication.isSubscribed ||
          publication.track.kind !== Track.Kind.Audio
        ) {
          return [];
        }
        const element = publication.track.attach();
        container.appendChild(element);
        return [{ track: publication.track, element }];
      });
    });

    return () => {
      attachedMedia.forEach(({ track, element }) => {
        track.detach(element);
        element.remove();
      });
    };
  }, [remoteParticipants]);

  // Prefer screen share over camera so the emphasized tile cannot be obscured.
  useEffect(() => {
    if (!renderVideo) return;

    const attachedMedia = remoteParticipants.flatMap((participant) => {
      const container = remoteVideoRefs.current[participant.sid];
      if (!container) return [];

      const publications = Array.from(participant.trackPublications.values());
      const screenShare = publications.find(
        (publication) =>
          publication.source === Track.Source.ScreenShare &&
          publication.track?.kind === Track.Kind.Video &&
          !publication.isMuted &&
          publication.isSubscribed
      );
      const visibleVideo = screenShare || publications.find(
        (publication) =>
          publication.source === Track.Source.Camera &&
          publication.track?.kind === Track.Kind.Video &&
          !publication.isMuted &&
          publication.isSubscribed
      );
      if (!visibleVideo?.track) return [];

      const element = visibleVideo.track.attach();
      element.className = "absolute inset-0 h-full w-full rounded-lg object-cover";
      container.appendChild(element);
      return [{ track: visibleVideo.track, element }];
    });

    return () => {
      attachedMedia.forEach(({ track, element }) => {
        track.detach(element);
        element.remove();
      });
    };
  }, [remoteParticipants, renderVideo]);

  if (!activeVoiceChannelId || !livekitToken) return null;

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;
  const connectionLabel = isConnected
    ? "Voice Connected"
    : isConnecting
      ? "Voice Connecting"
      : connectionState === ConnectionState.Reconnecting ||
          connectionState === ConnectionState.SignalReconnecting
        ? "Voice Reconnecting"
        : "Voice Disconnected";
  const hasLocalScreenShare = isConnected && localMedia.hasScreenShare;
  const isEffectivelyMuted = !canPublish || isMuted;
  const visibleConnectionError = connectionError ||
    (!wsUrl ? "LiveKit URL이 설정되지 않았습니다." : null);

  return (
    <div
      className="border-b border-white/5 bg-black/40 backdrop-blur-md"
      data-livekit-video-rendering={renderVideo ? "active" : "paused"}
    >
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {connectionLabel}
          {visibleConnectionError && (
            <span className="ml-2 text-red-400">— {visibleConnectionError}</span>
          )}
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-white"
        >
          {isCollapsed ? (
            <><span>Show</span><ChevronDown className="h-3 w-3" /></>
          ) : (
            <><span>Hide</span><ChevronUp className="h-3 w-3" /></>
          )}
        </button>
      </div>

      {/* Grid */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
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
                className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
              >
                오디오 재생 시작
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
            {/* Local participant tile */}
            <div
              className={`relative aspect-video overflow-hidden rounded-xl border bg-zinc-900 ${
                hasLocalScreenShare ? "col-span-2" : ""
              } ${
                activeSpeakerSids.includes(localParticipantSid)
                  ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                  : "border-white/5"
              }`}
            >
              <div
                ref={localVideoRef}
                className="h-full w-full flex items-center justify-center"
              >
                {!isCameraOn && !hasLocalScreenShare && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold uppercase text-white">
                      You
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                {isEffectivelyMuted && <MicOff className="h-2.5 w-2.5 text-red-400" />}
                You
              </div>
            </div>

            {/* Remote participant tiles */}
            {remoteParticipants.map((p) => {
              const isSpeaking = activeSpeakerSids.includes(p.sid);
              const hasVideo = Array.from(p.trackPublications.values()).some(
                (pub) => pub.track?.kind === Track.Kind.Video && !pub.isMuted && pub.isSubscribed
              );
              const isMutedRemote = Array.from(p.trackPublications.values()).some(
                (pub) => pub.track?.kind === Track.Kind.Audio && pub.isMuted
              );
              const hasAudio = Array.from(p.trackPublications.values()).some(
                (pub) =>
                  pub.track?.kind === Track.Kind.Audio &&
                  pub.isSubscribed &&
                  !pub.isMuted
              );
              const hasScreenShare = Array.from(p.trackPublications.values()).some(
                (pub) =>
                  pub.source === Track.Source.ScreenShare &&
                  !pub.isMuted &&
                  pub.isSubscribed
              );

              return (
                <div
                  key={p.sid}
                  data-livekit-participant={p.identity}
                  data-livekit-audio-subscribed={hasAudio}
                  data-livekit-video-source={hasScreenShare ? "screen_share" : hasVideo ? "camera" : "none"}
                  className={`relative aspect-video overflow-hidden rounded-xl border bg-zinc-900 ${
                    hasScreenShare ? "col-span-2" : ""
                  } ${
                    isSpeaking
                      ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "border-white/5"
                  }`}
                >
                  <div
                    ref={(el) => {
                      if (el) remoteVideoRefs.current[p.sid] = el;
                      else delete remoteVideoRefs.current[p.sid];
                    }}
                    className="h-full w-full flex items-center justify-center"
                  >
                    {!hasVideo && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold uppercase text-zinc-200">
                        {p.identity.substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                    {isMutedRemote && <MicOff className="h-2.5 w-2.5 text-red-400" />}
                    {p.name || p.identity}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2.5 border-t border-white/5">
            <ControlButton
              active={!isEffectivelyMuted}
              activeClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              inactiveClass="bg-red-500/10 text-red-400 border-red-500/20"
              onClick={toggleMute}
              title={canPublish ? (isMuted ? "Unmute" : "Mute") : "스테이지 청취자는 마이크를 사용할 수 없습니다"}
              ariaPressed={isMuted}
              disabled={!canPublish || !isConnected}
            >
              {isEffectivelyMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </ControlButton>

            <ControlButton
              active={isCameraOn}
              activeClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              inactiveClass="bg-red-500/10 text-red-400 border-red-500/20"
              onClick={toggleCamera}
              title={canPublish ? (isCameraOn ? "Camera Off" : "Camera On") : "스테이지 청취자는 카메라를 사용할 수 없습니다"}
              ariaPressed={isCameraOn}
              disabled={!canPublish || !isConnected}
            >
              {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </ControlButton>

            <ControlButton
              active={isScreenSharing}
              activeClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              inactiveClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              onClick={toggleScreenShare}
              title={canPublish ? "Share Screen" : "스테이지 청취자는 화면을 공유할 수 없습니다"}
              ariaPressed={isScreenSharing}
              disabled={!canPublish || !isConnected}
            >
              <Monitor className="h-4 w-4" />
            </ControlButton>

            <div className="h-5 w-px bg-white/10" />

            <button
              onClick={leaveVoiceChannel}
              className="flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-xs font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-500 active:scale-95"
            >
              <PhoneOff className="h-3.5 w-3.5" /> Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function getCanPublish(token: string | null): boolean {
  if (!token) return false;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as {
      video?: { canPublish?: boolean };
    };
    return payload.video?.canPublish === true;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "연결 실패";
}
