export const DELETED_MESSAGE_PREVIEW = "[deleted message]";

export type MessageReference = {
  id: string;
  channelId: string;
  replyToId: string | null;
  threadRootId: string | null;
  deletedAt: Date | string | null;
  content: string;
};

export function assertMessageReference(
  channelId: string,
  messageId: string,
  target: MessageReference | null
): asserts target is MessageReference {
  if (!target) throw new Error("message_reference_not_found");
  if (target.channelId !== channelId) throw new Error("cross_channel_reference");
  if (target.id === messageId) throw new Error("message_reference_cycle");
  if (target.threadRootId !== null || target.replyToId !== null) throw new Error("nested_thread_reference");
}

export function messagePreview(message: Pick<MessageReference, "content" | "deletedAt">) {
  if (message.deletedAt) return DELETED_MESSAGE_PREVIEW;
  const value = message.content.trim().replace(/\s+/g, " ");
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

export function isMainFeedMessage(message: Pick<MessageReference, "threadRootId">) {
  return message.threadRootId === null;
}
