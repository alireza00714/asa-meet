export type EphemeralChatMessage = {
  messageId: string;
  displayName: string;
  message: string;
  expiresAtUtc: string;
};

export function upsertMessage(
  source: EphemeralChatMessage[],
  incoming: EphemeralChatMessage
): EphemeralChatMessage[] {
  const next = source.filter((x) => x.messageId !== incoming.messageId);
  next.push(incoming);
  return next.sort((a, b) => a.expiresAtUtc.localeCompare(b.expiresAtUtc));
}

export function hardDeleteMessage(
  source: EphemeralChatMessage[],
  messageId: string
): EphemeralChatMessage[] {
  return source.filter((x) => x.messageId !== messageId);
}
