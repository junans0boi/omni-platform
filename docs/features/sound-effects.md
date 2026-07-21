# Sound effects

Omni uses short synthesized Web Audio tones, so there are no licensed external assets. Effects
are supplementary and fail open when autoplay is blocked or the audio backend fails. The default
is enabled at 35%; preference storage is scoped to the signed-in Profile in the browser.

The effect bus is separate from LiveKit remote audio and participant-local volume. Master off or
volume zero suppresses every effect. DND suppresses incoming Message/mention and remote participant
events while keeping local connect/disconnect/mute feedback. At most two effects play concurrently;
local feedback outranks mentions, participant churn, and inactive-channel messages. Repeated remote
join/leave events are throttled for one second.

Message prose is never parsed to infer recipients. `TARGETED_MENTION` is selected only from the
structured Mention record; #28 owns that recipient contract.
