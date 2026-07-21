export interface MessageCursor {
  id: string;
  createdAt: string;
}

export interface PageMessage extends MessageCursor {}

export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;
export const MAX_RETAINED_MESSAGES = 500;

export function clampMessagePageLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MESSAGE_PAGE_SIZE;
  return Math.min(parsed, MAX_MESSAGE_PAGE_SIZE);
}

export function encodeMessageCursor(cursor: MessageCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeMessageCursor(value: string): MessageCursor {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const parsed: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (
      typeof parsed !== "object" || parsed === null ||
      !("id" in parsed) || typeof parsed.id !== "string" || !parsed.id ||
      !("createdAt" in parsed) || typeof parsed.createdAt !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) throw new Error();
    return { id: parsed.id, createdAt: new Date(parsed.createdAt).toISOString() };
  } catch {
    throw new Error("Invalid message cursor");
  }
}

export function mergeMessagePage<T extends PageMessage>(
  current: T[],
  incoming: T[],
  maximum = MAX_RETAINED_MESSAGES,
): T[] {
  const messages = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) messages.set(item.id, item);
  return [...messages.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    .slice(-maximum);
}
