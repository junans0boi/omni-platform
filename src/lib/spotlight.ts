/**
 * Double-clicking a tile with video (camera or screen share) spotlights it —
 * this resolves the raw "last double-clicked" id against current room state
 * so a stale focus (participant left, video turned off) never lingers.
 */
export function resolveFocusedTile(params: {
  focusedTileId: string | null;
  localHasVideo: boolean;
  remoteParticipantSids: string[];
}): string | null {
  const { focusedTileId, localHasVideo, remoteParticipantSids } = params;
  if (focusedTileId === null) return null;
  if (focusedTileId === "local") return localHasVideo ? "local" : null;
  return remoteParticipantSids.includes(focusedTileId) ? focusedTileId : null;
}
