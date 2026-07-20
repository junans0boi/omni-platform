"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, RemoteParticipant, Participant, LocalVideoTrack, LocalAudioTrack } from "livekit-client";
import { useAppStore } from "@/store/useAppStore";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, ChevronUp, ChevronDown } from "lucide-react";

interface StreamTrack {
  id: string;
  participantSid: string;
  identity: string;
  track: Track;
  kind: "video" | "audio";
}

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tracks, setTracks] = useState<StreamTrack[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const videoContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!livekitToken || !activeVoiceChannelId) return;

    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://dummy-livekit-url.com";
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const handleRoomEvents = () => {
      room.on(RoomEvent.ParticipantConnected, () => {
        setParticipants(Array.from(room.participants.values()));
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setParticipants(Array.from(room.participants.values()));
        updateTracks();
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        updateTracks();
      });

      room.on(RoomEvent.TrackUnsubscribed, () => {
        updateTracks();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakerSids(speakers.map((s) => s.sid));
      });
    };

    const updateTracks = () => {
      const allTracks: StreamTrack[] = [];
      
      // Local tracks
      if (room.localParticipant) {
        room.localParticipant.trackPublications.forEach((pub) => {
          if (pub.track) {
            allTracks.push({
              id: pub.track.sid || "local-track",
              participantSid: room.localParticipant.sid,
              identity: room.localParticipant.identity,
              track: pub.track,
              kind: pub.track.kind as any,
            });
          }
        });
      }

      // Remote tracks
      room.participants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) {
            allTracks.push({
              id: pub.track.sid || `${p.sid}-${pub.track.kind}`,
              participantSid: p.sid,
              identity: p.identity,
              track: pub.track,
              kind: pub.track.kind as any,
            });
          }
        });
      });

      setTracks(allTracks);
    };

    const connect = async () => {
      try {
        await room.connect(wsUrl, livekitToken);
        setParticipants(Array.from(room.participants.values()));
        handleRoomEvents();
        updateTracks();
      } catch (err) {
        console.error("LiveKit connection error:", err);
      }
    };

    connect();

    return () => {
      room.disconnect();
      roomRef.current = null;
    };
  }, [livekitToken, activeVoiceChannelId]);

  // Handle Mute (audio publish toggle)
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    const syncMute = async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMuted);
      } catch (e) {
        console.error("Error setting microphone state:", e);
      }
    };
    syncMute();
  }, [isMuted, participants]);

  // Handle Camera (video publish toggle)
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    const syncCamera = async () => {
      try {
        await room.localParticipant.setCameraEnabled(!isCameraOn);
      } catch (e) {
        console.error("Error setting camera state:", e);
      }
    };
    syncCamera();
  }, [isCameraOn, participants]);

  // Handle Screen Share (screen share publish toggle)
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    const syncScreenShare = async () => {
      try {
        await room.localParticipant.setScreenShareEnabled(!isScreenSharing);
      } catch (e) {
        console.error("Error setting screen share state:", e);
      }
    };
    syncScreenShare();
  }, [isScreenSharing, participants]);

  // Dynamically attach track elements to rendering nodes
  useEffect(() => {
    tracks.forEach(({ track, participantSid }) => {
      const container = videoContainerRefs.current[participantSid];
      if (!container) return;

      // Clean existing elements of the same kind to prevent duplication
      const existing = container.querySelectorAll(track.kind);
      existing.forEach((el) => el.remove());

      if (track.kind === "video") {
        const el = track.attach();
        el.className = "h-full w-full object-cover rounded-lg";
        container.appendChild(el);
      } else if (track.kind === "audio") {
        const el = track.attach();
        container.appendChild(el);
      }
    });
  }, [tracks]);

  if (!activeVoiceChannelId || !livekitToken) return null;

  const room = roomRef.current;
  const localParticipantSid = room?.localParticipant?.sid;

  return (
    <div className="border-b border-white/5 bg-black/40 backdrop-blur-md transition-all duration-300">
      {/* 1. Header collapse bar */}
      <div className="flex h-9 items-center justify-between px-4 text-xs font-semibold text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Voice Session Connected
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
        >
          {isCollapsed ? (
            <>
              Show participants <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              Hide participants <ChevronUp className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {/* 2. Collapsible view grid */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ height: isCollapsed ? "0px" : "auto", opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Render local participant grid item */}
          {room?.localParticipant && (
            <div
              className={`relative aspect-video rounded-xl bg-zinc-900 border transition-all ${
                activeSpeakerSids.includes(localParticipantSid || "")
                  ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                  : "border-white/5"
              }`}
            >
              <div
                ref={(el) => {
                  if (localParticipantSid) videoContainerRefs.current[localParticipantSid] = el;
                }}
                className="h-full w-full rounded-xl overflow-hidden flex items-center justify-center bg-[#09090b]"
              >
                {!isCameraOn && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold uppercase">
                      You
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-2.5 left-2.5 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                You {isMuted && "(Muted)"}
              </div>
            </div>
          )}

          {/* Render remote participants */}
          {participants.map((p) => {
            const isSpeaking = activeSpeakerSids.includes(p.sid);
            const hasVideo = Array.from(p.trackPublications.values()).some(
              (pub) => pub.track?.kind === "video" && !pub.isMuted
            );
            return (
              <div
                key={p.sid}
                className={`relative aspect-video rounded-xl bg-zinc-900 border transition-all ${
                  isSpeaking
                    ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                    : "border-white/5"
                }`}
              >
                <div
                  ref={(el) => {
                    videoContainerRefs.current[p.sid] = el;
                  }}
                  className="h-full w-full rounded-xl overflow-hidden flex items-center justify-center bg-[#09090b]"
                >
                  {!hasVideo && (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold uppercase text-zinc-300">
                      {p.identity.substring(0, 2)}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2.5 left-2.5 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  {p.identity}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Action / Control bar */}
        <div className="flex items-center justify-center gap-4 bg-zinc-950/20 py-3 border-t border-white/5">
          <button
            onClick={toggleMute}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
              isMuted
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
              !isCameraOn
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white"
            }`}
            title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {!isCameraOn ? <VideoOff className="h-4.5 w-4.5" /> : <Video className="h-4.5 w-4.5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
              isScreenSharing
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white"
            }`}
            title="Share Screen"
          >
            <Monitor className="h-4.5 w-4.5" />
          </button>

          <div className="h-6 w-[1px] bg-white/10" />

          <button
            onClick={leaveVoiceChannel}
            className="flex h-10 w-24 items-center justify-center gap-1.5 rounded-full bg-red-600 text-xs font-semibold text-white transition hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/20"
            title="Disconnect"
          >
            <PhoneOff className="h-4.5 w-4.5" /> Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
