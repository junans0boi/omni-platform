# Voice channel extras

The active Voice/Stage Channel reuses the ordinary Message aggregate, membership checks,
history pagination, and Realtime channel topic. It does not create a second voice-chat store.
Leaving or switching the channel tears down the LiveKit Room while Message authorization remains
the same as every other Channel.

Remote participant volume is listener-local. Values are clamped to 0–100, keyed by listener
Profile and remote LiveKit identity (the Profile UUID), and reapplied whenever an audio track is
attached after republish or reconnect. Setting 0 changes only the local HTML audio element; it
never mutates a LiveKit publication, upstream gain, or another listener's preference. Effects
audio uses an independent Web Audio bus.
