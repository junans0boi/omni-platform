"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  Participant,
  RoomConnectOptions,
} from "livekit-client";
import { useAppStore } from "@/store/useAppStore";
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
  } = useAppStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!livekitToken || !activeVoiceChannelId) return;

    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    if (!wsUrl) {
      console.error("NEXT_PUBLIC_LIVEKIT_URL is not set in .env.local");
      setConnectionError("LiveKit URL이 설정되지 않았습니다.");
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setConnectionError(null);

    // livekit-client v2.x uses remoteParticipants (Map<string, RemoteParticipant>)
    const syncParticipants = () => {
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
    };

    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, syncParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    room.on(RoomEvent.TrackMuted, syncParticipants);
    room.on(RoomEvent.TrackUnmuted, syncParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setActiveSpeakerSids(speakers.map((s) => s.sid));
    });
    room.on(RoomEvent.Disconnected, () => {
      setRemoteParticipants([]);
    });

    const connect = async () => {
      try {
        await room.connect(wsUrl, livekitToken);
        syncParticipants();
      } catch (err: any) {
        console.error("LiveKit connection error:", err);
        setConnectionError(err.message || "연결 실패");
      }
    };

    connect();

    return () => {
      room.disconnect();
      roomRef.current = null;
      setRemoteParticipants([]);
    };
  }, [livekitToken, activeVoiceChannelId]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    room.localParticipant.setMicrophoneEnabled(!isMuted).catch((e) =>
      console.warn("Mic toggle error:", e.message)
    );
  }, [isMuted]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    room.localParticipant.setCameraEnabled(isCameraOn).catch((e) =>
      console.warn("Camera toggle error:", e.message)
    );
  }, [isCameraOn]);

  // ── Screen share toggle ───────────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    room.localParticipant.setScreenShareEnabled(isScreenSharing).catch((e) =>
      console.warn("Screen share error:", e.message)
    );
  }, [isScreenSharing]);

  // ── Attach local video track ──────────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    const container = localVideoRef.current;
    if (!room || !container) return;

    const syncLocalVideo = () => {
      container.querySelectorAll("video").forEach((el) => el.remove());
      const pub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        const el = pub.track.attach();
        el.className = "h-full w-full object-cover rounded-lg scale-x-[-1]";
        container.appendChild(el);
      }
    };

    // Initial sync (in case track is already published)
    syncLocalVideo();

    room.on(RoomEvent.LocalTrackPublished, syncLocalVideo);
    room.on(RoomEvent.LocalTrackUnpublished, syncLocalVideo);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, syncLocalVideo);
      room.off(RoomEvent.LocalTrackUnpublished, syncLocalVideo);
    };
  }, [isCameraOn, livekitToken, activeVoiceChannelId]);

  // ── Attach remote video tracks to DOM ────────────────────────────────────
  useEffect(() => {
    remoteParticipants.forEach((p) => {
      const container = remoteVideoRefs.current[p.sid];
      if (!container) return;

      // Clear existing media elements
      container.querySelectorAll("video, audio").forEach((el) => el.remove());

      p.trackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          const el = pub.track.attach();
          if (pub.track.kind === Track.Kind.Video) {
            el.className = "h-full w-full object-cover rounded-lg";
          }
          container.appendChild(el);
        }
      });
    });
  }, [remoteParticipants]);

  if (!activeVoiceChannelId || !livekitToken) return null;

  const room = roomRef.current;
  const localParticipant = room?.localParticipant;

  return (
    <div className="border-b border-white/5 bg-black/40 backdrop-blur-md">
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Voice Connected
          {connectionError && (
            <span className="ml-2 text-red-400">— {connectionError}</span>
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
      {!isCollapsed && (
        <div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
            {/* Local participant tile */}
            <div
              className={`relative aspect-video rounded-xl bg-zinc-900 border overflow-hidden ${
                activeSpeakerSids.includes(localParticipant?.sid || "")
                  ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                  : "border-white/5"
              }`}
            >
              <div
                ref={localVideoRef}
                className="h-full w-full flex items-center justify-center"
              >
                {!isCameraOn && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold uppercase text-white">
                      You
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                {isMuted && <MicOff className="h-2.5 w-2.5 text-red-400" />}
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

              return (
                <div
                  key={p.sid}
                  className={`relative aspect-video rounded-xl bg-zinc-900 border overflow-hidden ${
                    isSpeaking
                      ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "border-white/5"
                  }`}
                >
                  <div
                    ref={(el) => { remoteVideoRefs.current[p.sid] = el; }}
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
                    {p.identity}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2.5 border-t border-white/5">
            <ControlButton
              active={!isMuted}
              activeClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              inactiveClass="bg-red-500/10 text-red-400 border-red-500/20"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </ControlButton>

            <ControlButton
              active={isCameraOn}
              activeClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              inactiveClass="bg-red-500/10 text-red-400 border-red-500/20"
              onClick={toggleCamera}
              title={isCameraOn ? "Camera Off" : "Camera On"}
            >
              {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </ControlButton>

            <ControlButton
              active={isScreenSharing}
              activeClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              inactiveClass="bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              onClick={toggleScreenShare}
              title="Share Screen"
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
      )}
    </div>
  );
}

function ControlButton({
  children, onClick, title, active, activeClass, inactiveClass,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
  activeClass: string;
  inactiveClass: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95 ${active ? activeClass : inactiveClass}`}
    >
      {children}
    </button>
  );
}
